self.addEventListener("push", function (event) {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: "/images/logo-color.svg",
    badge: "/images/logo-light.svg",
    data: data.data,
    actions: data.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  if (event.action === "cancel") {
    return;
  }

  // Handle auth confirmation
  if (event.notification.data && event.notification.data.type === "auth_request") {
    const sessionId = event.notification.data.sessionId;
    const confirmUrl = "/api/trpc/auth.confirmPushAuth?batch=1";

    event.waitUntil(
      fetch(confirmUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "0": { json: { sessionId } }
        }),
      })
        .then(() => {
          return self.clients.matchAll({ type: "window" }).then(clients => {
            if (clients.length > 0) {
              clients[0].focus();
            } else {
              self.clients.openWindow("/account");
            }
          });
        })
        .catch(err => console.error("Confirm error:", err))
    );
  }
});
