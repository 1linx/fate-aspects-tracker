/**
 * FATE Aspects Tracker — Entry point
 *
 * Loaded last (after socket.js, aspects-app.js, aspects-editor.js).
 * Registers settings, initialises the socket, and adds the toolbar button.
 */

window.FateAspects = window.FateAspects || {};

// ----------------------------------------------------------------
// init — register settings before game data loads
// ----------------------------------------------------------------

Hooks.once('init', () => {
  // The ordered list of aspect items shared with all players.
  // Structure: [{ id, type: 'aspect'|'heading'|'subheading', text }]
  game.settings.register('fate-aspects-tracker', 'aspects', {
    scope:   'world',
    config:  false,
    type:    Object,
    default: [],
    onChange: () => FateAspects.App.onAspectsChange(),
  });

  // Per-user font size for the aspects window.
  game.settings.register('fate-aspects-tracker', 'fontSize', {
    scope:   'client',
    config:  false,
    type:    String,
    default: '1em',
    onChange: () => FateAspects.App.onStyleChange(),
  });

  // Text colour — world-scoped so the GM sets it for everyone.
  game.settings.register('fate-aspects-tracker', 'fontColour', {
    scope:   'world',
    config:  false,
    type:    String,
    default: '#ffffff',
    onChange: () => FateAspects.App.onStyleChange(),
  });

  // Background colour (hex) and opacity (0–100) — GM-controlled, world-scoped.
  game.settings.register('fate-aspects-tracker', 'bgColour', {
    scope:   'world',
    config:  false,
    type:    String,
    default: '#14060a',
    onChange: () => FateAspects.App.onStyleChange(),
  });

  game.settings.register('fate-aspects-tracker', 'bgOpacity', {
    scope:   'world',
    config:  false,
    type:    Number,
    default: 82,
    onChange: () => FateAspects.App.onStyleChange(),
  });

  // Set of actor IDs hidden by the GM. Hidden actors are invisible to players.
  game.settings.register('fate-aspects-tracker', 'hiddenActors', {
    scope:   'world',
    config:  false,
    type:    Object,
    default: [],
    onChange: () => FateAspects.App.onAspectsChange(),
  });
});

// ----------------------------------------------------------------
// ready — start the socket listener
// ----------------------------------------------------------------

Hooks.once('ready', () => {
  FateAspects.Socket.init();

  if (game.system.id === 'fate-core-official') {
    // Game aspects: the system emits this socket event after any GM change
    game.socket.on('system.fate-core-official', data => {
      if (data.render) FateAspects.App.onAspectsChange();
    });

    // Situation aspects: stored as scene flags, updated via setFlag → triggers updateScene
    Hooks.on('updateScene', (_scene, changes) => {
      if (changes?.flags?.['fate-core-official']) FateAspects.App.onAspectsChange();
    });

    // Re-read situation aspects whenever the active scene changes
    Hooks.on('canvasReady', () => FateAspects.App.onAspectsChange());

    // Character aspects: re-render when any actor is updated
    Hooks.on('updateActor', () => FateAspects.App.onAspectsChange());
  }
});

// ----------------------------------------------------------------
// Scene controls — add a scroll button to the token layer toolbar
// ----------------------------------------------------------------

Hooks.on('getSceneControlButtons', controls => {
  const tokenLayer = controls.tokens ?? controls.token;
  if (!tokenLayer) return;

  tokenLayer.tools['fate-aspects'] = {
    name:    'fate-aspects',
    title:   game.i18n.localize('ASPECTS.OpenWindow'),
    icon:    'fas fa-scroll',
    visible: true,
    toggle:  false,
    button:  true,
    onClick: () => FateAspects.App.toggle(),
  };
});
