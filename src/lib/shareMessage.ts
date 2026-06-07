export type GuestInviteMessageInput = {
  coupleNames: string;
  guestUrl: string;
  welcomeMessage?: string | null;
  inviteCode?: string | null;
};

/** WhatsApp / paylaşım için hazır davet metni. */
export function buildGuestInviteMessage(input: GuestInviteMessageInput): string {
  const { coupleNames, guestUrl, welcomeMessage, inviteCode } = input;
  const lines = [
    "Merhaba! 🎉",
    "",
    `${coupleNames} düğününe hoş geldiniz!`,
    "",
    "Bu güzel günde anılarınızı bizimle paylaşmak isterseniz QR kodu okutarak düğünde çektiğiniz fotoğraf ve videoları kolayca yükleyebilirsiniz.",
  ];

  const welcome = welcomeMessage?.trim();
  if (welcome) {
    lines.push("", welcome);
  }

  lines.push("", "🔗 Anı sayfası:", guestUrl);

  const code = inviteCode?.trim();
  if (code) {
    lines.push("", `Davet kodu: ${code}`);
  }

  lines.push("", "Sevgiyle 💛");
  return lines.join("\n");
}
