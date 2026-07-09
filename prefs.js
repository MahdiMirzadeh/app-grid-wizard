import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const FOLDER_CONFIGS = [
    {schemaKey: 'folder-accessories', title: () => _('Accessories'), subtitle: () => _('Utility apps')},
    {schemaKey: 'folder-chrome-apps', title: () => _('Chrome Apps'), subtitle: () => _('Chrome web applications')},
    {schemaKey: 'folder-games', title: () => _('Games'), subtitle: () => _('Gaming applications')},
    {schemaKey: 'folder-graphics', title: () => _('Graphics'), subtitle: () => _('Image and design tools')},
    {schemaKey: 'folder-internet', title: () => _('Internet'), subtitle: () => _('Network, browsers, and email')},
    {schemaKey: 'folder-office', title: () => _('Office'), subtitle: () => _('Productivity applications')},
    {schemaKey: 'folder-programming', title: () => _('Programming'), subtitle: () => _('Development tools')},
    {schemaKey: 'folder-science', title: () => _('Science'), subtitle: () => _('Scientific applications')},
    {schemaKey: 'folder-sound-video', title: () => _('Sound & Video'), subtitle: () => _('Audio and video applications')},
    {schemaKey: 'folder-system-tools', title: () => _('System Tools'), subtitle: () => _('System and settings')},
    {schemaKey: 'folder-universal-access', title: () => _('Universal Access'), subtitle: () => _('Accessibility tools')},
    {schemaKey: 'folder-wine', title: () => _('Wine'), subtitle: () => _('Windows applications')},
    {schemaKey: 'folder-waydroid', title: () => _('Waydroid'), subtitle: () => _('Android applications')}
];

export default class WizardPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Main page
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        // Info group
        const infoGroup = new Adw.PreferencesGroup({
            title: _('About'),
            description: _('App Grid Wizard automatically organizes your applications into folders'),
        });
        page.add(infoGroup);

        const infoRow = new Adw.ActionRow({
            title: _('How to use'),
            subtitle: _('Turn App Grid Wizard ON from Preferences or Quick Settings to create folders. Turning it OFF stops monitoring but keeps existing folders. Use Restore below to remove them.'),
        });
        infoGroup.add(infoRow);

        const behaviorGroup = new Adw.PreferencesGroup({
            title: _('Behavior'),
            description: _('Choose how App Grid Wizard is controlled'),
        });
        page.add(behaviorGroup);

        const enabledRow = new Adw.ActionRow({
            title: _('Enabled'),
            subtitle: _('Create folders and keep them updated automatically'),
        });
        const enabledSwitch = new Gtk.Switch({
            active: settings.get_boolean('enabled'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('enabled', enabledSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        enabledRow.add_suffix(enabledSwitch);
        enabledRow.activatable_widget = enabledSwitch;
        behaviorGroup.add(enabledRow);

        const quickSettingsRow = new Adw.ActionRow({
            title: _('Show in Quick Settings'),
            subtitle: _('Keep the App Grid Wizard toggle visible in GNOME Quick Settings'),
        });
        const quickSettingsSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-quick-settings'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind('show-quick-settings', quickSettingsSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        quickSettingsRow.add_suffix(quickSettingsSwitch);
        quickSettingsRow.activatable_widget = quickSettingsSwitch;
        behaviorGroup.add(quickSettingsRow);

        // Restore group
        const restoreGroup = new Adw.PreferencesGroup({
            title: _('Restore'),
            description: _('Remove all extension folders and restore original layout. Requires logout to take effect.'),
        });
        page.add(restoreGroup);

        const restoreRow = new Adw.ActionRow({
            title: _('Restore Original Folders'),
            subtitle: '',
        });
        
        const restoreButton = new Gtk.Button({
            label: _('Restore'),
            valign: Gtk.Align.CENTER,
            sensitive: settings.get_boolean('snapshot-taken'),
            css_classes: ['destructive-action'],
        });

        const syncRestoreState = () => {
            const hasSnapshot = settings.get_boolean('snapshot-taken');
            restoreRow.subtitle = hasSnapshot
                ? _('A snapshot is available')
                : _('No snapshot available yet (turn on App Grid Wizard first)');
            restoreButton.sensitive = hasSnapshot;
        };
        syncRestoreState();
        settings.connect('changed::snapshot-taken', syncRestoreState);
        
        restoreButton.connect('clicked', () => {
            const dialog = new Adw.MessageDialog({
                heading: _('Restore Original Folders?'),
                body: _('This will remove all folders created by App Grid Wizard and restore your original folder setup.'),
                transient_for: window,
                modal: true,
            });
            
            dialog.add_response('cancel', _('Cancel'));
            dialog.add_response('restore', _('Restore'));
            dialog.set_response_appearance('restore', Adw.ResponseAppearance.DESTRUCTIVE);
            
            dialog.connect('response', (dialog, response) => {
                if (response === 'restore') {
                    this._restoreSnapshot(settings);
                    restoreRow.subtitle = _('Restored! Log out and back in to see changes.');
                    settings.set_boolean('snapshot-taken', false);
                    restoreButton.sensitive = false;
                }
            });
            
            dialog.present();
        });
        
        restoreRow.add_suffix(restoreButton);
        restoreGroup.add(restoreRow);

        // Folders group
        const foldersGroup = new Adw.PreferencesGroup({
            title: _('Folders'),
            description: _('Choose which folders to create and manage'),
        });
        page.add(foldersGroup);

        for (const config of FOLDER_CONFIGS) {
            const row = new Adw.ActionRow({
                title: config.title(),
                subtitle: config.subtitle(),
            });

            const toggle = new Gtk.Switch({
                active: settings.get_boolean(config.schemaKey),
                valign: Gtk.Align.CENTER,
            });

            settings.bind(
                config.schemaKey,
                toggle,
                'active',
                Gio.SettingsBindFlags.DEFAULT
            );

            row.add_suffix(toggle);
            row.activatable_widget = toggle;
            foldersGroup.add(row);
        }

        // Credits group
        const creditsGroup = new Adw.PreferencesGroup({
            title: _('Credits'),
        });
        page.add(creditsGroup);

        const creditRow = new Adw.ActionRow({
            title: _('App Grid Wizard'),
            subtitle: _('Made with ❤️ by Mahdi Mirzadeh'),
        });
        
        const linkButton = new Gtk.Button({
            label: _('GitHub'),
            valign: Gtk.Align.CENTER,
        });
        
        linkButton.connect('clicked', () => {
            Gio.AppInfo.launch_default_for_uri(
                'https://github.com/MahdiMirzadeh/app-grid-wizard',
                null
            );
        });
        
        creditRow.add_suffix(linkButton);
        creditsGroup.add(creditRow);
    }

    _restoreSnapshot(settings) {
        const APP_FOLDER_SCHEMA_ID = 'org.gnome.desktop.app-folders';
        const shellSettings = new Gio.Settings({schema_id: 'org.gnome.shell'});

        if (settings.get_boolean('snapshot-taken')) {
            const folderSettings = new Gio.Settings({schema_id: APP_FOLDER_SCHEMA_ID});
            const original = settings.get_strv('original-folder-children');
            const originalLayout = settings.get_value('original-app-layout');
            
            // Restore original folders
            folderSettings.set_strv('folder-children', original);

            if (originalLayout.n_children() > 0)
                shellSettings.set_value('app-picker-layout', originalLayout);
            else
                shellSettings.set_value('app-picker-layout', new GLib.Variant('aa{sv}', []));

            settings.set_boolean('enabled', false);
            settings.set_boolean('snapshot-taken', false);
        }
    }
}
