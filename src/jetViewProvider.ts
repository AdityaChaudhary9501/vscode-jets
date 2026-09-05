import * as vscode from 'vscode';

export const AIRCRAFT_TYPES = ['f16', 'f22', 'f18', 'su57', 'su30', 'su25', 'eurofighter', 'jaguar', 'mig21', 'mig29', 'mirage2000'] as const;

export class JetViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'jets.view';

  private view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.type === 'ready') {
        const theme = vscode.window.activeColorTheme.kind;
        this.postMessage({ type: 'theme', kind: theme });
      }
    });
  }

  public postMessage(message: unknown): void {
    this.view?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.css'));
    const spriteUris: Record<string, string> = {};
    for (const type of AIRCRAFT_TYPES) {
      spriteUris[type] = webview
        .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'sprites', `${type}.png`))
        .toString();
    }
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Jets</title>
</head>
<body>
  <canvas id="jet-canvas"></canvas>
  <script nonce="${nonce}">window.__SPRITES__ = ${JSON.stringify(spriteUris)};</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
