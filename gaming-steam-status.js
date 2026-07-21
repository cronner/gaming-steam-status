const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class GamingSteamCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      config: {},
      _hideOffline: { type: Boolean },
    };
  }

  static getStubConfig() {
    return {
      title: "Steam",
      auto_populate: true,
      entities: [],
      hide_offline: false,
      show_steam_level: false,
      max_online: 0,
      max_offline: 0,
      sort_by: "status",
      compact_mode: false,
      click_action: "popup",
      click_action_target: "",
      show_toggle: true,
      card_size: "auto",
    };
  }

  setConfig(config) {
    this.config = config;
  }

  set hass(hass) {
    this._hass = hass;
    this._entities = this._discoverSteamEntities(hass);
    this.requestUpdate();
  }

  get hass() {
    return this._hass;
  }

  _discoverSteamEntities(hass) {
    const auto = this.config.auto_populate !== false;
    const filterList = this.config.entities || [];
    const useFilter = !auto && filterList.length > 0;

    const entities = [];
    for (const [entityId, state] of Object.entries(hass.states)) {
      if (!entityId.startsWith("sensor.steam_")) continue;
      if (entityId.includes("_firmware") || entityId.includes("_update")) continue;
      if (useFilter && !filterList.includes(entityId)) continue;

      const stateMap = { online: "online", away: "idle", snooze: "dnd", offline: "offline" };
      const mappedState = stateMap[state.state] || "offline";
      const displayName = (state.attributes.friendly_name || entityId).replace(/^Steam\s+/i, "");

      entities.push({
        entity: {
          entity_id: entityId,
          state: mappedState,
          attributes: {
            display_name: displayName,
            friendly_name: state.attributes.friendly_name || entityId,
            entity_picture: state.attributes.entity_picture || null,
          },
        },
        game: state.attributes.game || null,
        game_image_header: state.attributes.game_image_header || null,
        game_image_main: state.attributes.game_image_main || null,
        level: state.attributes.level || null,
      });
    }
    return entities;
  }

  _sortByStatus(entities) {
    const sortBy = this.config.sort_by || "status";
    const groups = { online: [], idle: [], dnd: [], offline: [], unavailable: [] };
    for (const e of entities) {
      const state = e.entity.state;
      const group = groups[state] || groups.offline;
      group.push(e);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        if (sortBy === "name") {
          const na = a.entity.attributes.display_name || "";
          const nb = b.entity.attributes.display_name || "";
          return na.localeCompare(nb);
        }
        if (sortBy === "game") {
          const ag = a.game && a.game !== "unknown" && a.game !== "None" ? a.game : "";
          const bg = b.game && b.game !== "unknown" && b.game !== "None" ? b.game : "";
          if (ag && !bg) return -1;
          if (!ag && bg) return 1;
          return ag.localeCompare(bg);
        }
        const na = a.entity.attributes.display_name || "";
        const nb = b.entity.attributes.display_name || "";
        return na.localeCompare(nb);
      });
    }
    return groups;
  }

  _stateLabel(state) {
    switch (state) {
      case "online": return "Online";
      case "idle": return "Inaktiv";
      case "dnd": return "Forstyr ikke";
      case "offline": return "Offline";
      default: return "Ukendt";
    }
  }

  _handleAction(entry) {
    const action = this.config.click_action || "popup";
    const target = this.config.click_action_target || "";
    const e = entry.entity;

    if (action === "navigate" && target) {
      history.pushState(null, "", target);
      const event = new Event("location-changed", { composed: true });
      window.dispatchEvent(event);
    } else if (action === "toggle" && target) {
      const domain = target.split(".")[0];
      this.hass.callService(domain, "toggle", { entity_id: target });
    } else {
      const event = new Event("hass-more-info", { composed: true });
      event.detail = { entityId: e.entity_id };
      this.dispatchEvent(event);
    }
  }

  _renderUserItem(entry) {
    const e = entry.entity;
    const attrs = e.attributes;
    const name = attrs.display_name || attrs.friendly_name || "Unknown";
    const avatar = attrs.entity_picture || "";
    const game = entry.game && entry.game !== "unknown" && entry.game !== "None" ? entry.game : null;
    let bgImg = this.config.compact_mode ? null : (entry.game_image_header || entry.game_image_main || null);
    const state = e.state;
    const compact = this.config.compact_mode;
    const hasLevel = this.config.show_steam_level && entry.level;

    return html`
      <div class="steam-multi ${state} ${compact ? "compact" : ""}" @click=${() => this._handleAction(entry)}>
        ${bgImg ? html`<img src="${bgImg}" class="steam-game-bg" onerror="this.style.display='none'">` : ""}
        <div class="steam-user ${compact ? "compact" : ""}">
          <div class="avatar-wrap ${state}">
            ${avatar ? html`<img src="${avatar}" class="steam-avatar ${state}" onerror="this.style.display='none'">` : html`<div class="steam-avatar ${state}"></div>`}
            ${hasLevel ? html`<div class="steam-level-badge">${entry.level}</div>` : ""}
          </div>
          <div class="user-container ${game ? "" : "no-game"}">
            <div class="steam-username ${state}">${name}</div>
            ${!compact ? html`
            <div class="steam-value ${state}">
              ${game ? game : this._stateLabel(state)}
            </div>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this._hass || !this._entities || this._entities.length === 0) {
      return html`<ha-card><div class="empty">Ingen Steam-brugere fundet</div></ha-card>`;
    }

    const hideOffline = this.config.hide_offline === true || this._hideOffline || this.config.show_offline === false;
    const showToggle = this.config.show_toggle !== false;
    const maxOnline = this.config.max_online || 0;
    const maxOffline = this.config.max_offline || 0;
    const compact = this.config.compact_mode;

    const groups = this._sortByStatus(this._entities);
    let allEntities = [...groups.online, ...groups.idle, ...groups.dnd, ...groups.unavailable, ...groups.offline];

    if (hideOffline) {
      allEntities = allEntities.filter(e => e.entity.state !== "offline");
    }

    let toRender = allEntities;
    const offlineCount = groups.offline.length;

    if (!hideOffline && maxOffline > 0) {
      const online = toRender.filter(e => e.entity.state !== "offline");
      let offline = toRender.filter(e => e.entity.state === "offline");
      offline = offline.slice(0, maxOffline);
      toRender = [...online, ...offline];
    }
    if (maxOnline > 0) {
      const online = toRender.filter(e => e.entity.state !== "offline").slice(0, maxOnline);
      const offline = toRender.filter(e => e.entity.state === "offline");
      toRender = [...online, ...offline];
    }

    return html`
      <ha-card>
        ${this.config.title || showToggle ? html`
        <div class="card-header">
          <div class="name">${this.config.title ? html`<ha-icon icon="mdi:steam" class="steam-icon"></ha-icon> ${this.config.title}` : ""}</div>
          ${showToggle && offlineCount > 0 ? html`
            <div class="toggle-btn" @click=${this._toggleOffline}>
              <ha-icon icon="${hideOffline ? "mdi:eye-off" : "mdi:eye"}"></ha-icon>
              <span>${hideOffline ? "Vis offline (" + offlineCount + ")" : "Skjul offline"}</span>
            </div>
          ` : ""}
        </div>
        ` : ""}
        <div class="user-grid ${compact ? "compact" : ""}">
          ${toRender.map(e => this._renderUserItem(e))}
        </div>
      </ha-card>
    `;
  }

  _toggleOffline() {
    this._hideOffline = !this._hideOffline;
  }

  getCardSize() {
    return 3;
  }

  static get styles() {
    return css`
      ha-card {
        padding: 16px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .card-header {
        width: 100%;
        padding-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .card-header .name {
        font-size: 1.2em;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .steam-icon {
        --mdc-icon-size: 20px;
        color: #66c0f4;
      }
      .toggle-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75em;
        opacity: 0.6;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        transition: opacity 0.15s, background 0.15s;
        user-select: none;
      }
      .toggle-btn:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.08);
      }
      .toggle-btn ha-icon {
        --mdc-icon-size: 16px;
      }
      .empty {
        text-align: center;
        padding: 16px;
        opacity: 0.5;
      }
      .user-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px;
        margin-bottom: 4px;
      }
      .user-grid.compact {
        gap: 2px;
        margin-bottom: 2px;
      }
      .steam-multi {
        position: relative;
        overflow: hidden;
        border-radius: 8px;
        min-height: 48px;
        cursor: pointer;
        transition: opacity 0.15s;
      }
      .steam-multi.compact {
        min-height: 36px;
        border-radius: 6px;
      }
      .steam-multi.offline {
        opacity: 0.45;
      }
      .steam-multi:hover {
        opacity: 1;
      }
      .steam-game-bg {
        z-index: 0;
        position: absolute;
        top: 0;
        right: 0;
        height: 100%;
        width: 100%;
        object-fit: cover;
        opacity: 0.4;
        mask-image: linear-gradient(to right, transparent 5%, black 70%);
        -webkit-mask-image: linear-gradient(to right, transparent 5%, black 70%);
      }
      .steam-user {
        display: flex;
        align-items: center;
        padding: 6px 8px;
        position: relative;
        z-index: 1;
        gap: 8px;
      }
      .steam-user.compact {
        padding: 4px 6px;
        gap: 6px;
      }
      .avatar-wrap {
        flex-shrink: 0;
        position: relative;
      }
      .steam-avatar {
        width: 36px;
        height: 36px;
        min-width: 36px;
        min-height: 36px;
        border-radius: 50%;
        border-style: solid;
        border-width: 2px;
        object-fit: cover;
      }
      .steam-multi.compact .steam-avatar {
        width: 28px;
        height: 28px;
        min-width: 28px;
        min-height: 28px;
      }
      .steam-avatar.online {
        border-color: #6cff4f9d;
        box-shadow: 1px 0.5px 3px #6cff4f88;
      }
      .steam-avatar.idle {
        border-color: #d6ca1c9d;
        box-shadow: 1px 0.5px 3px #d6ca1c88;
      }
      .steam-avatar.dnd {
        border-color: #4081e49d;
        box-shadow: 1px 0.5px 3px #4081e488;
      }
      .steam-avatar.offline {
        border-color: #aaaaaa9d;
        opacity: 0.3;
        box-shadow: 1px 0.5px 3px #aaaaaa88;
      }
      .steam-level-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        background: rgba(0, 0, 0, 0.75);
        color: #fff;
        font-size: 9px;
        padding: 1px 3px;
        border-radius: 3px;
        font-weight: 600;
        line-height: 1.1;
        pointer-events: none;
      }
      .user-container {
        margin-left: 0;
        width: 100%;
        min-width: 0;
        overflow: hidden;
        align-content: center;
      }
      .user-container.no-game {
        align-items: center;
      }
      .steam-username {
        width: 100%;
        font-weight: 600;
        font-size: 0.85em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .steam-multi.compact .steam-username {
        font-size: 0.78em;
      }
      .steam-username.offline {
        opacity: 0.5;
      }
      .steam-value {
        width: 100%;
        font-size: 0.72em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .steam-value.offline {
        opacity: 0.5;
      }
    `;
  }
}

customElements.define("gaming-steam-card", GamingSteamCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "gaming-steam-card",
  name: "Gaming Steam Card",
  description: "Auto-discovers Steam entities and displays them compactly with game backgrounds.",
});
