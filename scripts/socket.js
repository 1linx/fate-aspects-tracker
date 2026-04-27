/**
 * FATE Aspects Tracker — Socket handler
 *
 * Only used to push the window open on all non-GM clients.
 * Aspect list changes sync automatically via the world-scoped setting onChange.
 */

window.FateAspects = window.FateAspects || {};

FateAspects.Socket = {
  CHANNEL: 'module.fate-aspects-tracker',

  init() {
    game.socket.on(this.CHANNEL, data => this.handle(data));
  },

  emit(type, payload = {}) {
    game.socket.emit(this.CHANNEL, { type, payload });
  },

  handle({ type }) {
    if (type === 'FORCE_OPEN' && !game.user.isGM) {
      FateAspects.App.open();
    }
  },
};
