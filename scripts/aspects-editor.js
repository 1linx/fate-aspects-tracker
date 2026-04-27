/**
 * FATE Aspects Tracker — Aspect Editor (GM only)
 *
 * Text-format editor. Each non-empty line is an entry:
 *   Lines starting with "#  " → heading
 *   Lines starting with "## " → sub-heading
 *   All other lines           → aspect
 *
 * Example:
 *   # Scene Aspects
 *   On Fire!
 *   Slippery Floor
 *
 *   ## Zone: Back Alley
 *   Narrow Corridors
 *   Poor Lighting
 */

window.FateAspects = window.FateAspects || {};

class AspectEditorApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: 'fate-aspects-editor',
    classes: ['fate-aspects-tracker', 'fate-aspects-editor'],
    window: {
      title: 'ASPECTS.EditorTitle',
      icon: 'fas fa-edit',
      resizable: true,
    },
    position: { width: 520, height: 500 },
    actions: {
      saveAspects: AspectEditorApp._onSaveAspects,
    },
  };

  static PARTS = {
    main: {
      template: 'modules/fate-aspects-tracker/templates/aspects-editor.hbs',
    },
  };

  async _prepareContext(_options) {
    const aspects = game.settings.get('fate-aspects-tracker', 'aspects') ?? [];
    const text = aspects.map(item => {
      if (item.type === 'heading')    return `# ${item.text}`;
      if (item.type === 'subheading') return `## ${item.text}`;
      return item.text;
    }).join('\n');
    return { aspectsText: text };
  }

  static _parseText(raw) {
    return raw
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map((line, i) => {
        if (line.startsWith('## ')) return { id: `item-${i}`, type: 'subheading', text: line.slice(3).trim() };
        if (line.startsWith('# '))  return { id: `item-${i}`, type: 'heading',    text: line.slice(2).trim() };
        return { id: `item-${i}`, type: 'aspect', text: line };
      });
  }

  static async _onSaveAspects(_event, _target) {
    const textarea = this.element.querySelector('textarea[name="aspectsText"]');
    const aspects  = AspectEditorApp._parseText(textarea?.value ?? '');
    await game.settings.set('fate-aspects-tracker', 'aspects', aspects);
    ui.notifications.info(game.i18n.localize('ASPECTS.Saved'));
    this.close();
  }
}

FateAspects.EditorApp = AspectEditorApp;
