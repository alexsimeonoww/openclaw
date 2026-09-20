import AppKit
import Foundation
import Testing
import WebKit
@testable import OpenClaw

@Suite(.serialized)
@MainActor
struct DashboardSessionShortcutDeliveryTests {
    @Test(arguments: [("o", UInt16(31)), ("a", UInt16(0))], ["body", "composer"])
    func `session chords reach the focused dashboard body and composer through AppKit`(
        chord: (key: String, keyCode: UInt16), target: String) async throws
    {
        _ = AppKitTestSupport.application
        let server = try await DashboardHTTPFixture.start(
            html: """
            <!doctype html><html><body id="body" tabindex="-1">
            <textarea id="composer">Unchanged draft</textarea>
            <script>
            window.keyEvents = [];
            document.addEventListener('keydown', event => {
              window.keyEvents.push({
                key: event.key, code: event.code, target: event.target.id,
                meta: event.metaKey, shift: event.shiftKey, control: event.ctrlKey,
                alt: event.altKey, repeated: event.repeat, trusted: event.isTrusted
              });
              event.preventDefault();
            });
            </script></body></html>
            """,
            contentSecurityPolicy: "default-src 'none'; script-src 'unsafe-inline'")
        defer { server.stop() }
        let auth = DashboardWindowAuth(gatewayUrl: nil, token: nil, password: nil)
        let controller = DashboardWindowController(
            url: server.url(), auth: auth, websiteDataStore: .nonPersistent(),
            windowAutosaveName: "", requestBrowserProfileImportOffer: { _ in false })
        defer { controller.closeDashboard() }
        controller.show(url: server.url(), auth: auth)
        try await self.waitUntil {
            !controller.webView.isLoading && controller.canDeliverNativeCommands
        }
        let window = try #require(controller.window)
        try #require(window.makeFirstResponder(controller.webView))
        // JavaScript only selects and observes focus; it never constructs or dispatches a key event.
        let focused = try await controller.webView.evaluateJavaScript("""
        document.getElementById('\(target)').focus();
        document.activeElement.id;
        """) as? String
        try #require(focused == target)
        let responder = try #require(window.firstResponder as? NSView)
        try #require(responder === controller.webView || responder.isDescendant(of: controller.webView))
        #expect(try await self.keyEvents(in: controller.webView).isEmpty)

        let event = try #require(NSEvent.keyEvent(
            with: .keyDown,
            location: .zero,
            modifierFlags: [.command, .shift],
            timestamp: ProcessInfo.processInfo.systemUptime,
            windowNumber: window.windowNumber,
            context: nil,
            characters: chord.key.uppercased(),
            charactersIgnoringModifiers: chord.key.uppercased(),
            isARepeat: false,
            keyCode: chord.keyCode))
        // Use ordinary AppKit dispatch, including its key-equivalent and responder routing.
        // Never call WebKit keyDown directly or synthesize a DOM event. This still does not
        // exercise physical input or install the full SwiftUI application menu.
        NSApp.sendEvent(event)
        try await self.waitUntil {
            try await !self.keyEvents(in: controller.webView).isEmpty
        }
        let observed = try await self.keyEvents(in: controller.webView)
        #expect(observed == [KeyObservation(
            key: chord.key.uppercased(), code: "Key\(chord.key.uppercased())", target: target,
            meta: true, shift: true, control: false, alt: false, repeated: false, trusted: true)])
        #expect(try await controller.webView.evaluateJavaScript(
            "document.getElementById('composer').value") as? String == "Unchanged draft")
    }

    private struct KeyObservation: Decodable, Equatable {
        let key: String
        let code: String
        let target: String
        let meta: Bool
        let shift: Bool
        let control: Bool
        let alt: Bool
        let repeated: Bool
        let trusted: Bool
    }

    private func keyEvents(in webView: WKWebView) async throws -> [KeyObservation] {
        let json = try #require(try await webView.evaluateJavaScript("JSON.stringify(window.keyEvents)") as? String)
        return try JSONDecoder().decode([KeyObservation].self, from: Data(json.utf8))
    }

    private func waitUntil(_ condition: () async throws -> Bool) async throws {
        let deadline = ContinuousClock.now + .seconds(5)
        while try await !condition() {
            guard ContinuousClock.now < deadline else { throw URLError(.timedOut) }
            try await Task.sleep(for: .milliseconds(10))
        }
    }
}
