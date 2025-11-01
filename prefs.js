import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const FOLDER_CONFIGS = [
    {schemaKey: 'folder-accessories', title: 'Accessories', subtitle: 'Utility apps'},
    {schemaKey: 'folder-chrome-apps', title: 'Chrome Apps', subtitle: 'Chrome web applications'},
    {schemaKey: 'folder-games', title: 'Games', subtitle: 'Gaming applications'},
    {schemaKey: 'folder-graphics', title: 'Graphics', subtitle: 'Image and design tools'},
    {schemaKey: 'folder-internet', title: 'Internet', subtitle: 'Network, browsers, and email'},
    {schemaKey: 'folder-office', title: 'Office', subtitle: 'Productivity applications'},
    {schemaKey: 'folder-programming', title: 'Programming', subtitle: 'Development tools'},
    {schemaKey: 'folder-science', title: 'Science', subtitle: 'Scientific applications'},
    {schemaKey: 'folder-sound-video', title: 'Sound &amp; Video', subtitle: 'Audio and video applications'},
    {schemaKey: 'folder-system-tools', title: 'System Tools', subtitle: 'System and settings'},
    {schemaKey: 'folder-universal-access', title: 'Universal Access', subtitle: 'Accessibility tools'},
    {schemaKey: 'folder-wine', title: 'Wine', subtitle: 'Windows applications'},
    {schemaKey: 'folder-waydroid', title: 'Waydroid', subtitle: 'Android applications'}
];

export default class WizardPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        
        // Main page
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        // Info group
        const infoGroup = new Adw.PreferencesGroup({
            title: 'About',
            description: 'App Grid Wizard automatically organizes your applications into folders',
        });
        page.add(infoGroup);

        const infoRow = new Adw.ActionRow({
            title: 'How to use',
            subtitle: 'Toggle ON creates folders. Toggle OFF keeps folders but stops monitoring. Use Restore button below to remove folders.',
        });
        infoGroup.add(infoRow);


        // Restore group
        const restoreGroup = new Adw.PreferencesGroup({
            title: 'Restore',
            description: 'Remove all extension folders and restore original layout. Requires logout to take effect.',
        });
        page.add(restoreGroup);

        const restoreRow = new Adw.ActionRow({
            title: 'Restore Original Folders',
            subtitle: settings.get_boolean('snapshot-taken') 
                ? 'A snapshot is available' 
                : 'No snapshot available yet (enable the extension first)',
        });
        
        const restoreButton = new Gtk.Button({
            label: 'Restore',
            valign: Gtk.Align.CENTER,
            sensitive: settings.get_boolean('snapshot-taken'),
            css_classes: ['destructive-action'],
        });
        
        restoreButton.connect('clicked', () => {
            const dialog = new Adw.MessageDialog({
                heading: 'Restore Original Folders?',
                body: 'This will remove all folders created by App Grid Wizard and restore your original folder setup.',
                transient_for: window,
                modal: true,
            });
            
            dialog.add_response('cancel', 'Cancel');
            dialog.add_response('restore', 'Restore');
            dialog.set_response_appearance('restore', Adw.ResponseAppearance.DESTRUCTIVE);
            
            dialog.connect('response', (dialog, response) => {
                if (response === 'restore') {
                    this._restoreSnapshot(settings);
                    restoreRow.subtitle = 'Restored! Log out and back in to see changes.';
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
            title: 'Folders',
            description: 'Choose which folders to create and manage',
        });
        page.add(foldersGroup);

        for (const config of FOLDER_CONFIGS) {
            const row = new Adw.ActionRow({
                title: config.title,
                subtitle: config.subtitle,
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
            title: 'Credits',
        });
        page.add(creditsGroup);

        const creditRow = new Adw.ActionRow({
            title: 'App Grid Wizard',
            subtitle: 'Made with ❤️ by Mahdi Mirzadeh',
        });
        
        const linkButton = new Gtk.Button({
            label: 'GitHub',
            valign: Gtk.Align.CENTER,
        });
        
        linkButton.connect('clicked', () => {
            Gtk.show_uri(window, 'https://github.com/MahdiMirzadeh/app-grid-wizard', Gtk.get_current_event_time());
        });
        
        creditRow.add_suffix(linkButton);
        creditsGroup.add(creditRow);
    }

    _restoreSnapshot(settings) {
        const APP_FOLDER_SCHEMA_ID = 'org.gnome.desktop.app-folders';
        const APP_FOLDER_SCHEMA_PATH = '/org/gnome/desktop/app-folders/folders/';
        
        const FOLDER_IDS = [
            'agw-accessories', 'agw-chrome-apps', 'agw-games', 'agw-graphics',
            'agw-internet', 'agw-office', 'agw-programming', 'agw-science',
            'agw-sound-video', 'agw-system-tools', 'agw-universal-access',
            'agw-wine', 'agw-waydroid'
        ];
        
        if (settings.get_boolean('snapshot-taken')) {
            const folderSettings = new Gio.Settings({schema_id: APP_FOLDER_SCHEMA_ID});
            const original = settings.get_strv('original-folder-children');
            
            // Restore original folders
            folderSettings.set_strv('folder-children', original);

            // Restore original layout if we have one
            try {
                const originalLayout = settings.get_value('original-app-layout');
                if (originalLayout && originalLayout.n_children && originalLayout.n_children() > 0) {
                    const shellSettings = new Gio.Settings({schema_id: 'org.gnome.shell'});
                    shellSettings.set_value('app-picker-layout', originalLayout);
                } else {
                    const shellSettings = new Gio.Settings({schema_id: 'org.gnome.shell'});
                    shellSettings.set_value('app-picker-layout', new (imports.gi.GLib).Variant('aa{sv}', []));
                }
            } catch (e) {
                console.error('App-Grid-Wizard: Failed to restore app layout from snapshot', e);
            }

            settings.set_boolean('enabled', false);
            settings.set_boolean('snapshot-taken', false);

            try {
                const { Gio: GioNS } = imports.gi;
                const app = GioNS.Application.get_default();
                // Best-effort hint; Extensions app will reflect the disabled state already via GSettings
            } catch (e) {
                console.error('App-Grid-Wizard: Failed to notify app after disabling', e);
            }
        }
    }
}
