import * as vscode from 'vscode';
import { JetViewProvider } from './jetViewProvider';

const AIRCRAFT_CHOICES: { label: string; description: string; value: string }[] = [
  { label: 'F-16', description: 'Fighting Falcon', value: 'f16' },
  { label: 'F-22', description: 'Raptor', value: 'f22' },
  { label: 'F/A-18', description: 'Hornet', value: 'f18' },
  { label: 'Su-57', description: 'Felon', value: 'su57' },
  { label: 'Su-30', description: 'Flanker-C', value: 'su30' },
  { label: 'Su-25', description: 'Frogfoot', value: 'su25' }
];

export function activate(context: vscode.ExtensionContext) {
  const provider = new JetViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(JetViewProvider.viewType, provider),
    vscode.commands.registerCommand('jets.reset', () => provider.postMessage({ type: 'reset' })),
    vscode.commands.registerCommand('jets.boost', () => provider.postMessage({ type: 'boost' })),
    vscode.commands.registerCommand('jets.toggleSky', () => provider.postMessage({ type: 'toggleSky' })),
    vscode.commands.registerCommand('jets.removeJet', () => provider.postMessage({ type: 'removeJet' })),
    vscode.commands.registerCommand('jets.addJet', async () => {
      const pick = await vscode.window.showQuickPick(AIRCRAFT_CHOICES, { placeHolder: 'Choose an aircraft to add' });
      if (pick) {
        provider.postMessage({ type: 'addJet', aircraft: pick.value });
      }
    })
  );
}

export function deactivate() {}
