const POWERSHELL = "/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe"
const APP_ID = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe"

const MAX_TITLE = 60
const MAX_MESSAGE = 240

const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`

const xmlEscape = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

function buildScript(title, message, sound) {
  const xml =
    '<toast><visual><binding template="ToastGeneric">' +
    `<text>${xmlEscape(title)}</text>` +
    `<text>${xmlEscape(message)}</text>` +
    "</binding></visual>" +
    `<audio src="ms-winsoundevent:${sound}"/>` +
    "</toast>"
  return [
    "$ErrorActionPreference='Stop'",
    "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null",
    "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime] | Out-Null",
    "$xml = New-Object Windows.Data.Xml.Dom.XmlDocument",
    `$xml.LoadXml(${psQuote(xml)})`,
    "$toast = New-Object Windows.UI.Notifications.ToastNotification $xml",
    `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier(${psQuote(APP_ID)}).Show($toast)`,
  ].join("; ")
}

function describe(event) {
  if (event.type === "permission.asked") {
    return { title: "opencode", message: "Permission needs input", sound: "Notification.IM" }
  }

  if (event.type === "question.asked") {
    const questions = event.properties?.questions ?? []
    const first = questions[0] ?? {}
    let message = first.question ?? "Question needs input"
    if (questions.length > 1) message += ` (+${questions.length - 1})`
    return {
      title: String(first.header || "opencode").slice(0, MAX_TITLE),
      message: String(message).slice(0, MAX_MESSAGE),
      sound: "Notification.Default",
    }
  }

  return undefined
}

export const WindowsNotifyPlugin = async ({ $ }) => {
  return {
    event: async ({ event }) => {
      const info = describe(event)
      if (!info) return
      const encoded = Buffer.from(buildScript(info.title, info.message, info.sound), "utf16le").toString("base64")
      await $`${POWERSHELL} -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ${encoded}`.quiet().nothrow()
    },
  }
}
