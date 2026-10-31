// Imported by the generated service worker: tapping a flight reminder opens its trip.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/trips", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      return open ? open.focus().then(() => open.navigate(url)) : self.clients.openWindow(url);
    }),
  );
});
