import * as vscode from 'vscode';
import { JetViewProvider } from './jetViewProvider';

const AIRCRAFT_CHOICES: { label: string; description: string; value: string }[] = [
  { label: 'F-16', description: 'Fighting Falcon', value: 'f16' },
  { label: 'F-22', description: 'Raptor', value: 'f22' },
  { label: 'F/A-18', description: 'Hornet', value: 'f18' },
  { label: 'Su-57', description: 'Felon', value: 'su57' },
  { label: 'Su-30', description: 'Flanker-C', value: 'su30' },
  { label: 'Su-25', description: 'Frogfoot', value: 'su25' },
  { label: 'Eurofighter', description: 'Typhoon', value: 'eurofighter' },
  { label: 'Jaguar', description: 'SEPECAT Jaguar', value: 'jaguar' },
  { label: 'MiG-21', description: 'Fishbed', value: 'mig21' },
  { label: 'MiG-29', description: 'Fulcrum', value: 'mig29' },
  { label: 'Mirage 2000', description: 'Dassault Mirage 2000', value: 'mirage2000' }
];

const FORMATION_CHOICES: { label: string; description: string; value: string }[] = [
  { label: 'None', description: 'Free flight (default)', value: 'none' },
  { label: 'V-Formation', description: 'Classic Vic, wingmen fanned out behind the leader', value: 'v' },
  { label: 'Line Abreast', description: 'Side by side with the leader', value: 'line' },
  { label: 'Echelon', description: 'Staggered diagonal line', value: 'echelon' },
  { label: 'Diamond', description: 'Four-ship diamond', value: 'diamond' },
  { label: 'Trail', description: 'Single-file column behind the leader', value: 'trail' }
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
    }),
    vscode.commands.registerCommand('jets.formation', async () => {
      const pick = await vscode.window.showQuickPick(FORMATION_CHOICES, { placeHolder: 'Choose a formation, or None to disable' });
      if (pick) {
        provider.postMessage({ type: 'formation', value: pick.value });
      }
    })
  );
}

export function deactivate() {}
