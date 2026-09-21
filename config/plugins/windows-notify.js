const POWERSHELL = "/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe"

const MAX_TITLE = 60
const MAX_MESSAGE = 240

const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`

function buildScript(title, message, sound) {
  return [
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    `$p = New-Object Media.SoundPlayer 'C:\\Windows\\Media\\${sound}'`,
    "$p.Play()",
    "$n = New-Object System.Windows.Forms.NotifyIcon",
    "$n.Icon = [System.Drawing.SystemIcons]::Information",
    `$n.BalloonTipTitle = ${psQuote(title)}`,
    `$n.BalloonTipText = ${psQuote(message)}`,
    "$n.Visible = $true",
    "$n.ShowBalloonTip(5000)",
    "Start-Sleep -Seconds 6",
    "$n.Dispose()",
  ].join("; ")
}

function describe(event) {
  if (event.type === "permission.asked") {
    return { title: "opencode", message: "Permission needs input", sound: "Windows Exclamation.wav" }
  }

  if (event.type === "question.asked") {
    const questions = event.properties?.questions ?? []
    const first = questions[0] ?? {}
    let message = first.question ?? "Question needs input"
    if (questions.length > 1) message += ` (+${questions.length - 1})`
    return {
      title: String(first.header || "opencode").slice(0, MAX_TITLE),
      message: String(message).slice(0, MAX_MESSAGE),
      sound: "Windows Notify System Generic.wav",
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
      await $`${POWERSHELL} -NoProfile -EncodedCommand ${encoded}`.quiet().nothrow()
    },
  }
}
