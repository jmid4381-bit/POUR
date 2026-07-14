/* POUR guest-ordering service worker — Phase 2 push notifications.
 *
 * Intentionally minimal: this is NOT an offline/caching service worker. Its
 * only job is to receive pushes from the server (via the Push API) and show an
 * OS notification, so a guest gets alerted when their order is ready/delivered
 * even with the tab backgrounded or the browser closed.
 */

self.addEventListener("install", (event) => {
  // Activate this SW immediately rather than waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "POUR", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "POUR";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    // Vibrate on devices that support it (Android). Ignored on iOS.
    vibrate: data.bright ? [120, 60, 120, 60, 240] : [200, 100, 200],
    // tag = one notification per order; renotify so a newer status replaces
    // the older one instead of stacking.
    tag: data.orderId ? `order-${data.orderId}` : undefined,
    renotify: Boolean(data.orderId),
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab if one is already open, else open a new one.
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
