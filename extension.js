import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import {QuickToggle, QuickMenuToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const APP_FOLDER_SCHEMA_ID = 'org.gnome.desktop.app-folders';
const APP_FOLDER_SCHEMA_PATH = '/org/gnome/desktop/app-folders/folders/';
const DEBOUNCE_DELAY = 2000;

const FOLDER_CONFIGS = [
    {id: 'agw-accessories', schemaKey: 'folder-accessories', name: () => _('Accessories'), categories: ['Utility']},
    {id: 'agw-chrome-apps', schemaKey: 'folder-chrome-apps', name: () => _('Chrome Apps'), categories: ['chrome-apps']},
    {id: 'agw-games', schemaKey: 'folder-games', name: () => _('Games'), categories: ['Game']},
    {id: 'agw-graphics', schemaKey: 'folder-graphics', name: () => _('Graphics'), categories: ['Graphics']},
    {id: 'agw-internet', schemaKey: 'folder-internet', name: () => _('Internet'), categories: ['Network', 'WebBrowser', 'Email']},
    {id: 'agw-office', schemaKey: 'folder-office', name: () => _('Office'), categories: ['Office']},
    {id: 'agw-programming', schemaKey: 'folder-programming', name: () => _('Programming'), categories: ['Development']},
    {id: 'agw-science', schemaKey: 'folder-science', name: () => _('Science'), categories: ['Science']},
    {id: 'agw-sound-video', schemaKey: 'folder-sound-video', name: () => _('Sound & Video'), categories: ['AudioVideo', 'Audio', 'Video']},
    {id: 'agw-system-tools', schemaKey: 'folder-system-tools', name: () => _('System Tools'), categories: ['System', 'Settings']},
    {id: 'agw-universal-access', schemaKey: 'folder-universal-access', name: () => _('Universal Access'), categories: ['Accessibility']},
    {id: 'agw-wine', schemaKey: 'folder-wine', name: () => _('Wine'), categories: ['Wine', 'X-Wine', 'Wine-Programs-Accessories']},
    {id: 'agw-waydroid', schemaKey: 'folder-waydroid', name: () => _('Waydroid'), categories: ['Waydroid', 'X-WayDroid-App']}
];

class AppFolderManager {
    constructor(extensionSettings) {
        this._folderSettings = new Gio.Settings({schema_id: APP_FOLDER_SCHEMA_ID});
        this._extensionSettings = extensionSettings;
        this._shellSettings = new Gio.Settings({schema_id: 'org.gnome.shell'});
        this._sources = new Set();
    }

    _trackSource(id) {
        if (id)
            this._sources.add(id);
        return id;
    }

    cancelSources() {
        for (const id of this._sources)
            GLib.Source.remove(id);
        this._sources.clear();
    }

    resetLayout() {
        this._trackSource(GLib.timeout_add(GLib.PRIORITY_LOW, 300, () => {
            const empty = new GLib.Variant('aa{sv}', []);
            this._shellSettings.set_value('app-picker-layout', empty);
            console.debug('App-Grid-Wizard: Layout set to [] for auto-pagination');
            return GLib.SOURCE_REMOVE;
        }));
    }

    takeSnapshot() {
        if (!this._extensionSettings.get_boolean('snapshot-taken')) {
            const current = this._folderSettings.get_strv('folder-children');
            this._extensionSettings.set_strv('original-folder-children', current);
            try {
                const layout = this._shellSettings.get_value('app-picker-layout');
                this._extensionSettings.set_value('original-app-layout', layout);
            } catch (e) {
                console.error('App-Grid-Wizard: Failed to snapshot app-picker-layout', e);
            }
            this._extensionSettings.set_boolean('snapshot-taken', true);
            console.debug('App-Grid-Wizard: Snapshot saved');
        }
    }

    restoreSnapshot() {
        if (!this._extensionSettings.get_boolean('snapshot-taken'))
            return;

        const original = this._extensionSettings.get_strv('original-folder-children');
        const originalLayout = this._extensionSettings.get_value('original-app-layout');
        
        this._folderSettings.set_strv('folder-children', original);
        // Apply original layout after folders are present
        this._trackSource(GLib.timeout_add(GLib.PRIORITY_LOW, 200, () => {
            try {
                if (originalLayout && originalLayout.n_children && originalLayout.n_children() > 0)
                    this._shellSettings.set_value('app-picker-layout', originalLayout);
                else
                    this.resetLayout();
            } catch (e) {
                console.error('App-Grid-Wizard: Failed to apply original app layout; falling back to auto layout', e);
                this.resetLayout();
            }
            console.debug('App-Grid-Wizard: Snapshot restored');
            return GLib.SOURCE_REMOVE;
        }));
    }

    applyFolders() {
        const enabledConfigs = FOLDER_CONFIGS.filter(c => 
            this._extensionSettings.get_boolean(c.schemaKey)
        );
        
        // Replace all folders with only our enabled folders
        const ourIds = enabledConfigs.map(c => c.id);
        this._folderSettings.set_strv('folder-children', ourIds);
        
        // Configure enabled folders
        for (const config of enabledConfigs) {
            const folderPath = `${APP_FOLDER_SCHEMA_PATH}${config.id}/`;
            const folderSchema = Gio.Settings.new_with_path('org.gnome.desktop.app-folders.folder', folderPath);
            folderSchema.set_string('name', config.name());
            folderSchema.set_strv('categories', config.categories);
        }
        
        console.debug('App-Grid-Wizard: Folders applied');
        this.resetLayout();
    }

    removeFolders() {
        const current = this._folderSettings.get_strv('folder-children');
        const ourIds = FOLDER_CONFIGS.map(c => c.id);
        const filtered = current.filter(id => !ourIds.includes(id));
        this._folderSettings.set_strv('folder-children', filtered);
        console.debug('App-Grid-Wizard: Folders removed');
    }
}

const WizardToggle = GObject.registerClass(
class WizardToggle extends QuickMenuToggle {
    _init(extensionSettings, uuid) {
        super._init({
            title: 'App Grid Wizard',
            iconName: 'view-grid-symbolic',
            toggleMode: true,
        });

        this._extensionSettings = extensionSettings;
        this._folderManager = new AppFolderManager(extensionSettings);
        this._monitorId = null;
        this._debounceTimeoutId = null;
        this._settingsChangedIds = [];
        this._uuid = uuid;

        this.checked = this._extensionSettings.get_boolean('enabled');
        this.connect('clicked', this._onClicked.bind(this));
        
        // Reflect external changes to the 'enabled' flag (e.g., from preferences)
        this._enabledChangedId = this._extensionSettings.connect('changed::enabled', () => {
            const enabled = this._extensionSettings.get_boolean('enabled');
            if (this.checked === enabled)
                return;
            this.checked = enabled;
            if (enabled) {
                this._folderManager.takeSnapshot();
                this._folderManager.applyFolders();
                this._startMonitoring();
            } else {
                this._folderManager.resetLayout();
                this._stopMonitoring();
            }
        });
        
        // Watch for folder preference changes
        for (const config of FOLDER_CONFIGS) {
            const id = this._extensionSettings.connect(`changed::${config.schemaKey}`, () => {
                if (this.checked) {
                    this._scheduleUpdate();
                }
            });
            this._settingsChangedIds.push(id);
        }
        
        // Menu items
        const restoreItem = new PopupMenu.PopupMenuItem(_('Restore Original Layout'));
        restoreItem.connect('activate', () => {
            this._folderManager.restoreSnapshot();
            this._extensionSettings.set_boolean('snapshot-taken', false);
            this._extensionSettings.set_boolean('enabled', false);
            this.checked = false;
            this._stopMonitoring();
        });
        this.menu.addMenuItem(restoreItem);

        const prefsItem = new PopupMenu.PopupMenuItem(_('More Settings…'));
        prefsItem.connect('activate', () => {
            try {
                Main.extensionManager.openExtensionPrefs(this._uuid, '', null);
            } catch (e) {
                console.error('App-Grid-Wizard: Failed to open preferences', e);
            }
        });
        this.menu.addMenuItem(prefsItem);
        
        if (this.checked) {
            this._startMonitoring();
        }
    }

    _onClicked() {
        this._extensionSettings.set_boolean('enabled', this.checked);
        
        if (this.checked) {
            this._folderManager.takeSnapshot();
            this._folderManager.applyFolders();
            this._startMonitoring();
        } else {
            // Non-destructive: keep folders, just stop monitoring and compact layout
            this._folderManager.resetLayout();
            this._stopMonitoring();
        }
    }

    _startMonitoring() {
        if (this._monitorId) return;

        const appSystem = Shell.AppSystem.get_default();
        this._monitorId = appSystem.connect('installed-changed', () => {
            this._scheduleUpdate();
        });
        console.debug('App-Grid-Wizard: Monitoring started');
    }

    _scheduleUpdate() {
        if (this._debounceTimeoutId)
            GLib.Source.remove(this._debounceTimeoutId);
        
        this._debounceTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DEBOUNCE_DELAY, () => {
            if (this.checked) {
                this._folderManager.applyFolders();
            }
            this._debounceTimeoutId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _stopMonitoring() {
        if (this._monitorId) {
            Shell.AppSystem.get_default().disconnect(this._monitorId);
            this._monitorId = null;
        }
        
        if (this._debounceTimeoutId) {
            GLib.Source.remove(this._debounceTimeoutId);
            this._debounceTimeoutId = null;
        }
        console.debug('App-Grid-Wizard: Monitoring stopped');
    }

    destroy() {
        this._stopMonitoring();
        
        // Disconnect settings watchers
        for (const id of this._settingsChangedIds) {
            this._extensionSettings.disconnect(id);
        }
        this._settingsChangedIds = [];
        if (this._enabledChangedId)
            this._extensionSettings.disconnect(this._enabledChangedId);
        this._enabledChangedId = null;
        
        // Reset layout once on teardown to avoid sparse pages
        this._folderManager.resetLayout();
        // Cancel any pending layout/reset sources
        this._folderManager.cancelSources();
        super.destroy();
    }
});

const WizardIndicator = GObject.registerClass(
class WizardIndicator extends SystemIndicator {
    _init(extensionSettings, uuid) {
        super._init();
        this.quickSettingsItems.push(new WizardToggle(extensionSettings, uuid));
    }
    destroy() {
        // Ensure quick settings items are destroyed
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});

export default class WizardManagerExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new WizardIndicator(this._settings, this.metadata.uuid);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        console.debug('App-Grid-Wizard: Enabled');
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._settings = null;
        console.debug('App-Grid-Wizard: Disabled');
    }
}