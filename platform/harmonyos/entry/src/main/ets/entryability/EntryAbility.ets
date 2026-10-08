import { UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';

export default class EntryAbility extends UIAbility {
  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (err) => { if (err) { console.error(`load content failed: ${JSON.stringify(err)}`); } });
  }
  onCreate(_want: Want): void {}
  onWindowStageDestroy(): void {}
}
