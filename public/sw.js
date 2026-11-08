self.addEventListener('push', (evento) => {
  const dados = evento.data?.json() ?? { title: 'Mundinho Kids', body: 'Você tem uma nova notificação.' };
  evento.waitUntil(self.registration.showNotification(dados.title, {
    body: dados.body,
    icon: '/logo.svg',
    badge: '/logo.svg',
    tag: dados.tag ?? 'mundinho-kids',
    renotify: true,
    silent: false,
    vibrate: [100, 50, 100],
    data: { url: dados.url ?? '/notificacoes' },
  }));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
    const cliente = clientes.find((item) => 'focus' in item);
    if (cliente) return cliente.focus().then(() => cliente.navigate(evento.notification.data.url));
    return self.clients.openWindow(evento.notification.data.url);
  }));
});
