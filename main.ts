import { hideExpressionExample } from "_examples";
import { Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { Form, IForm } from "src/form";
import { ConfirmationModal } from "src/settings/confirmation-modal";
import { HandleFormModal } from "src/settings/handle-form-modal";

interface FormBo extends IForm {
	id: string;
	active: boolean;
}

interface MyPluginSettings {
	forms: FormBo[];
}

class mySettingsTab extends PluginSettingTab {
	private readonly FORM_LIST_ITEM_CLASS = "form-list-item";

	plugin: MyPlugin;
	settings: MyPluginSettings;

	constructor(plugin: MyPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;

		this.plugin.loadSettings();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Create new form")
			.setDesc("Click here to create a new form")
			.addButton((btn) =>
				btn.setButtonText("Create form").onClick(() =>
					new HandleFormModal({
						app: this.app,
						onSubmit: this.onCreateFormSubmit.bind(this),
						type: "Create",
					}).open()
				)
			);

		containerEl.createEl("h2", { text: "Forms" });

		this.renderFormList();
	}

	async onCreateFormSubmit(createdForm: IForm) {
		const formId = `${createdForm.title?.replace(/\s/gm, "-")}-${new Date()
			.getTime()
			.toString(36)}`;

		const createdFormBo: FormBo = {
			id: formId,
			active: true,
			...createdForm,
		};

		this.plugin.settings.forms = this.plugin.settings.forms?.length
			? [createdFormBo, ...this.plugin.settings.forms]
			: [createdFormBo];

		await this.plugin.saveSettings();

		this.renderFormList();
	}

	private renderFormList() {
		this.removeFieldsSection();

		this.plugin.settings.forms?.forEach((form) => {
			this.createFormItemList(form);
			if (form.active) this.plugin.addCommandForm(form);
		});
	}

	private createFormItemList(form: FormBo) {
		new Setting(this.containerEl)
			.setName(form.title)
			.setDesc(form.path)
			.setClass(this.FORM_LIST_ITEM_CLASS)
			.addExtraButton((extraButton) =>
				extraButton.setIcon("gear").onClick(() => {
					const updateForm = new HandleFormModal({
						app: this.app,
						onSubmit: this.getUpdateFormCallback(form.id).bind(
							this
						),
						formData: form,
						type: "Update",
					});
					updateForm.open();
				})
			)
			.addExtraButton((extraButton) =>
				extraButton.setIcon("trash-2").onClick(() => {
					const confirmationModal = new ConfirmationModal({
						app: this.app,
						title: "Are you sure?",
						description: `Are you sure you want to delete the ${form.title} form?`,
						onSubmit: this.getDeleteFormCallback(form).bind(this),
						submitLabel: "Delete",
					});

					confirmationModal.open();
				})
			)
			.addToggle((toggle) => {
				toggle
					.setValue(form.active)
					.onChange(this.getToogleFormActiveCallback(form.id));
			});
	}

	getUpdateFormCallback(formId: string) {
		return async (updatedForm: IForm) => {
			this.plugin.settings.forms = this.plugin.settings.forms.map(
				(form) => {
					if (form.id === formId) {
						form = Object.assign(form, updatedForm);
					}
					return form;
				}
			);

			await this.plugin.saveSettings();

			this.renderFormList();
		};
	}

	private getToogleFormActiveCallback(formId: string) {
		return () => {
			const formToToogle = this.plugin.settings.forms.find(
				(form) => form.id === formId
			);

			if (formToToogle) formToToogle.active = !formToToogle?.active;
			else
				console.error(
					`[toogleFormActive] Can't find form with id ${formId}`
				);

			this.plugin.saveSettings();
			this.renderFormList();
		};
	}

	private getDeleteFormCallback(form: FormBo) {
		return () => {
			this.plugin.settings.forms = this.plugin.settings.forms.filter(
				(f) => f.id !== form.id
			);

			if (form.active) new Notice("Reload plugin to fully remove form");

			this.plugin.saveSettings();
			this.renderFormList();
		};
	}

	private removeFieldsSection() {
		const fieldEls = this.containerEl.querySelectorAll(
			`.${this.FORM_LIST_ITEM_CLASS}`
		);

		fieldEls?.forEach((fieldEl) => fieldEl?.remove());
	}
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.saveSettings();
		await this.loadSettings();

		const formParams: IForm = {
			formFields: hideExpressionExample,
			title: "This is a form field",
			path: "expenses/",
			submitLabel: "Submit ribbon form",
		};

		this.addRibbonIcon("wallet", formParams.title, () => {
			new Form(this.app, formParams);
		});

		this.addSettingTab(new mySettingsTab(this));

		this.activateForms();
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			// DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private activateForms() {
		this.settings.forms?.forEach((form) => {
			if (form.active) this.addCommandForm(form);
		});
	}

	public addCommandForm(form: FormBo) {
		this.addCommand({
			id: form.id,
			name: form.title,
			callback: () => {
				new Form(this.app, form).open();
			},
		});
	}
}
