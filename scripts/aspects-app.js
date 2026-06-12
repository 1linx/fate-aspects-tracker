/**
 * FATE Aspects Tracker — Main window
 *
 * Floats over the canvas with a semi-transparent background.
 * All users can invoke or compel any aspect, which posts to chat.
 *
 * GM-only controls:
 *   Edit Aspects  → opens AspectEditorApp
 *   Open for All  → pushes the window to every connected player
 *
 * Per-user controls:
 *   Style         → dialog to set font size and colour (client-scoped settings)
 */

window.FateAspects = window.FateAspects || {};

class AspectTrackerApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: 'fate-aspects-tracker-app',
    classes: ['fate-aspects-tracker'],
    window: {
      title: 'ASPECTS.WindowTitle',
      icon: 'fas fa-scroll',
      resizable: true,
      minimizable: true,
    },
    position: { width: 580, height: 680 },
    actions: {
      invokeAspect:    AspectTrackerApp._onInvokeAspect,
      compelAspect:    AspectTrackerApp._onCompelAspect,
      openEditor:      AspectTrackerApp._onOpenEditor,
      openForAll:      AspectTrackerApp._onOpenForAll,
      openSettings:    AspectTrackerApp._onOpenSettings,
      toggleHideActor:    AspectTrackerApp._onToggleHideActor,
      togglePlayerPreview: AspectTrackerApp._onTogglePlayerPreview,
    },
  };

  static PARTS = {
    main: {
      template: 'modules/fate-aspects-tracker/templates/aspects-app.hbs',
      scrollable: ['.aspects-list'],
    },
  };

  // ----------------------------------------------------------------
  // Context
  // ----------------------------------------------------------------

  async _prepareContext(_options) {
    const isGM          = game.user.isGM;
    const playerPreview = isGM && (this._playerPreview ?? false);
    const effectiveGM   = isGM && !playerPreview;

    const raw        = game.settings.get('fate-aspects-tracker', 'aspects') ?? [];
    const fontSize   = game.settings.get('fate-aspects-tracker', 'fontSize');
    const fontColour = game.settings.get('fate-aspects-tracker', 'fontColour');
    const bgColour   = game.settings.get('fate-aspects-tracker', 'bgColour');
    const bgOpacity  = game.settings.get('fate-aspects-tracker', 'bgOpacity');
    const bgStyle    = AspectTrackerApp._hexToRgba(bgColour, bgOpacity / 100);

    const manualAspects = raw.map(item => ({
      ...item,
      isAspect:     item.type === 'aspect',
      isHeading:    item.type === 'heading',
      isSubheading: item.type === 'subheading',
    }));

    const systemAspects = AspectTrackerApp._getSystemAspects();
    const charAspects   = AspectTrackerApp._getCharacterAspects(effectiveGM);

    const sections = [
      ...systemAspects,
      ...charAspects,
      ...(manualAspects.length && (systemAspects.length || charAspects.length)
        ? [{ id: 'manual-divider', type: 'divider', isAspect: false, isSubheading: false }]
        : []),
      ...manualAspects,
    ];
    const aspects = sections;

    return {
      isGM:          effectiveGM,
      playerPreview,
      aspects,
      noAspects: aspects.length === 0,
      fontSize,
      fontColour,
      bgStyle,
    };
  }

  static _hexToRgba(hex, opacity) {
    const h = (hex ?? '#14060a').replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // ----------------------------------------------------------------
  // fate-core-official integration
  // ----------------------------------------------------------------

  static _getSystemAspects() {
    if (game.system.id !== 'fate-core-official') return [];
    const items = [];

    // Situation aspects from the current scene
    const sitAspects = game.scenes?.viewed?.getFlag('fate-core-official', 'situation_aspects') ?? [];
    const sitActive  = sitAspects.filter(a => a.name?.trim());
    if (sitActive.length) {
      items.push({ id: 'sys-sit-h', type: 'heading', text: 'Situation Aspects', isHeading: true, isAspect: false, isSubheading: false });
      for (const a of sitActive) {
        items.push({ id: `sys-sit-${a.name}`, type: 'aspect', text: a.name, isAspect: true, isHeading: false, isSubheading: false });
      }
    }

    // Game aspects (world-level)
    const gameAspects = game.settings.get('fate-core-official', 'gameAspects') ?? [];
    const gameActive  = gameAspects.filter(a => a.name?.trim());
    if (gameActive.length) {
      items.push({ id: 'sys-game-h', type: 'heading', text: 'Game Aspects', isHeading: true, isAspect: false, isSubheading: false });
      for (const a of gameActive) {
        items.push({ id: `sys-game-${a.name}`, type: 'aspect', text: a.name, isAspect: true, isHeading: false, isSubheading: false });
      }
    }

    return items;
  }

  static _getCharacterAspects(isGM = game.user.isGM) {
    if (game.system.id !== 'fate-core-official') return [];
    const items = [];

    const raw     = game.settings.get('fate-aspects-tracker', 'visibleActors') ?? [];
    const visible = new Set(Array.isArray(raw) ? raw : Object.values(raw));

    const actors = game.actors.filter(a =>
      a.type === 'fate-core-official' &&
      a.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER)
    );

    for (const actor of actors) {
      // Hidden = not in the explicit visible set (all hidden by default)
      const isHidden = !visible.has(actor.id);

      // Players never see hidden actors
      if (isHidden && !isGM) continue;

      const aspects = Object.values(actor.system.aspects ?? {})
        .filter(a => a.value?.trim());

      // Skip actors with no aspects — unless hidden, so GM can still see the heading to reveal them
      if (!aspects.length && !isHidden) continue;

      items.push({
        id:            `char-${actor.id}-h`,
        type:          'heading',
        text:          actor.name,
        isHeading:     true,
        isAspect:      false,
        isSubheading:  false,
        isCharHeading: true,
        actorId:       actor.id,
        isHidden,
      });

      if (!isHidden) {
        for (const a of aspects) {
          items.push({
            id: `char-${actor.id}-${a.name}`,
            type: 'aspect', text: a.value, label: a.name,
            isAspect: true, isHeading: false, isSubheading: false,
          });
        }
      }
    }

    return items;
  }

  // ----------------------------------------------------------------
  // Actions
  // ----------------------------------------------------------------

  static async _onInvokeAspect(_event, target) {
    const aspect = target.dataset.aspect;
    ChatMessage.create({
      content: `<p class="fate-chat-message"><strong>${game.user.name}</strong> invokes <em>${aspect}</em></p>`,
    });
  }

  static async _onCompelAspect(_event, target) {
    const aspect = target.dataset.aspect;
    ChatMessage.create({
      content: `<p class="fate-chat-message"><strong>${game.user.name}</strong> compels <em>${aspect}</em></p>`,
    });
  }

  static async _onOpenEditor(_event, _target) {
    if (!FateAspects._editor) {
      FateAspects._editor = new FateAspects.EditorApp();
    }
    FateAspects._editor.render({ force: true });
  }

  static async _onOpenForAll(_event, _target) {
    FateAspects.Socket.emit('FORCE_OPEN');
    FateAspects.App.open();
  }

  static async _onOpenSettings(_event, _target) {
    const isGM           = game.user.isGM;
    const currentSize    = game.settings.get('fate-aspects-tracker', 'fontSize');
    const currentColour  = game.settings.get('fate-aspects-tracker', 'fontColour');
    const currentBg      = game.settings.get('fate-aspects-tracker', 'bgColour');
    const currentOpacity = game.settings.get('fate-aspects-tracker', 'bgOpacity');

    const sizeOptions = [
      { value: '0.8em',  label: 'Small' },
      { value: '1em',    label: 'Medium' },
      { value: '1.2em',  label: 'Large' },
      { value: '1.45em', label: 'X-Large' },
    ];
    const optionsHtml = sizeOptions
      .map(o => `<option value="${o.value}"${currentSize === o.value ? ' selected' : ''}>${o.label}</option>`)
      .join('');

    const gmFields = isGM ? `
      <div class="form-group">
        <label>Text Colour <span class="at-gm-note">(all players)</span></label>
        <input type="color" name="fontColour" value="${currentColour}">
      </div>
      <div class="form-group">
        <label>Background <span class="at-gm-note">(all players)</span></label>
        <input type="color" name="bgColour" value="${currentBg}">
      </div>
      <div class="form-group">
        <label>Opacity % <span class="at-gm-note">(all players)</span></label>
        <input type="number" name="bgOpacity" min="0" max="100" value="${currentOpacity}">
      </div>
    ` : '';

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('ASPECTS.SettingsTitle') },
      content: `
        <div class="form-group">
          <label>Text Size</label>
          <select name="fontSize">${optionsHtml}</select>
        </div>
        ${gmFields}
      `,
      buttons: [
        {
          action:   'save',
          label:    game.i18n.localize('ASPECTS.Save'),
          icon:     'fas fa-save',
          default:  true,
          callback: (_event, button) => {
            const f   = button.form;
            const out = { fontSize: f.elements.fontSize.value };
            if (isGM) {
              out.fontColour = f.elements.fontColour.value;
              out.bgColour   = f.elements.bgColour.value;
              out.bgOpacity  = Number(f.elements.bgOpacity.value);
            }
            return out;
          },
        },
        {
          action: 'cancel',
          label:  'Cancel',
          icon:   'fas fa-times',
        },
      ],
    });

    if (!result) return;
    await game.settings.set('fate-aspects-tracker', 'fontSize', result.fontSize);
    if (isGM) {
      await game.settings.set('fate-aspects-tracker', 'fontColour', result.fontColour);
      await game.settings.set('fate-aspects-tracker', 'bgColour',   result.bgColour);
      await game.settings.set('fate-aspects-tracker', 'bgOpacity',  result.bgOpacity);
    }
  }

  static _onTogglePlayerPreview(_event, _target) {
    this._playerPreview = !this._playerPreview;
    this.render({ force: true });
  }

  static async _onToggleHideActor(_event, target) {
    const actorId = target.dataset.actorId;
    const raw     = game.settings.get('fate-aspects-tracker', 'visibleActors') ?? [];
    const visible = new Set(Array.isArray(raw) ? raw : Object.values(raw));
    if (visible.has(actorId)) visible.delete(actorId);
    else visible.add(actorId);
    await game.settings.set('fate-aspects-tracker', 'visibleActors', Array.from(visible));
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  static open() {
    if (!FateAspects._app?.rendered) FateAspects._app = new AspectTrackerApp();
    FateAspects._app.render({ force: true });
  }

  static toggle() {
    if (FateAspects._app?.rendered) {
      FateAspects._app.close();
    } else {
      FateAspects.App.open();
    }
  }

  static onAspectsChange() {
    if (FateAspects._app?.rendered) FateAspects._app.render();
  }

  static onStyleChange() {
    if (FateAspects._app?.rendered) FateAspects._app.render();
  }
}

FateAspects.App = AspectTrackerApp;
