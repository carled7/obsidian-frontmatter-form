import { App, Notice, TFile } from "obsidian";
import { FormFieldFactory } from "src/form-field/form-field.factory";
import { getClassNamesFromExpression, getFilePathsFromExpression } from "utils";

export class ExpressionEvaluator {
	app: App;
	constructor(app: App) {
		this.app = app;
	}

	async evaluateExpression<T>(
		expression?: string,
		expressionContext?: FormFieldFactory[]
	): Promise<T | any> {
		if (!expression) return "";

		const [prefix, expressionToEvaluate, suffix] =
			expression.includes("{{") && expression.includes("}}")
				? ExpressionEvaluator.splitExpression(expression)
				: [expression, "", ""];

		if (!expressionToEvaluate) return prefix;

		const parsedExpression = await this.parseExpression(
			expressionToEvaluate,
			expressionContext
		);

		try {
			const expressionResult: T = new Function(
				parsedExpression.includes("return")
					? parsedExpression
					: `return ${parsedExpression};`
			)();
			return prefix
				? `${prefix}${expressionResult}${suffix ?? ""}`
				: expressionResult;
		} catch (error) {
			new Notice(`Error on evaluating ${expression} expression`);
			console.error(expressionToEvaluate);
			console.error(error);

			return `${prefix}${suffix ?? ""}`;
		}
	}

	async parseExpression(
		expression: string,
		expressionContext?: FormFieldFactory[]
	): Promise<string> {
		//#region parse expression context
		const formFieldClassNames = expressionContext
			? getClassNamesFromExpression(expression)
			: [];

		formFieldClassNames.forEach((formFieldClassName) => {
			const formField = expressionContext?.find(
				(formField) =>
					formField.formField.className === formFieldClassName
			);

			const classNameMatcher = new RegExp(
				`\\$\\$\\.${formField?.formField.className}`
			);

			const isFilePath = new RegExp(
				`%%.*\\$\\$\\.${formField?.formField.className}.*%%`,
				"g"
			);

			const valueToReplace = isFilePath.test(expression)
				? `${formField?.formField?.content?.value ?? ""}`
				: `'${formField?.formField?.content?.value ?? ""}'`;

			expression = expression.replace(classNameMatcher, valueToReplace);
		});
		//#endregion

		//#region parse file content
		const filePaths = getFilePathsFromExpression(expression);

		await Promise.all(
			filePaths.map(async (abstractFilePath) => {
				const abstractFilePathMatcher = /%%.*%%/;

				if (abstractFilePath.endsWith("/")) {
					const folderPath = abstractFilePath.endsWith("/")
						? abstractFilePath.slice(0, -1)
						: abstractFilePath;

					const folder = this.app.vault.getFolderByPath(folderPath);

					if (!folder) {
						new Notice(`Folder not found at ${folderPath}`);
						return;
					}

					const fileNames = folder?.children.map(
						(child: TFile) => child.basename ?? child.name
					);

					expression = expression.replace(
						abstractFilePathMatcher,
						JSON.stringify(fileNames)
					);

					return;
				}

				const [_, fileExtension] = abstractFilePath.split(".");

				if (fileExtension && fileExtension !== "md") {
					new Notice(
						`Can't handle .${fileExtension} extension, .md expected`
					);

					expression = expression.replace(
						abstractFilePathMatcher,
						""
					);
					return;
				}

				if (!fileExtension) abstractFilePath = `${abstractFilePath}.md`;

				const file = this.app.vault.getFileByPath(abstractFilePath);

				if (!file) {
					new Notice(`File not found at ${abstractFilePath}`);
					return;
				}

				let fileFrontMatter = "";
				await this.app.fileManager.processFrontMatter(
					file,
					(frontmatter: string) => (fileFrontMatter = frontmatter)
				);

				expression = expression.replace(
					abstractFilePathMatcher,
					JSON.stringify(fileFrontMatter)
				);
			})
		);
		//#endregion

		return expression;
	}

	static splitExpression(expression: string): string[] {
		if (!(expression.includes("{{") && expression.includes("}}")))
			return [expression];

		const expressionMatcher = new RegExp(/{{(.*)}}/);

		const expressionToEvaluate = expressionMatcher.exec(expression)?.at(-1);

		const prefix = expression.split("{{")[0];
		const sufix = expression.split("}}")[1];

		return [prefix, expressionToEvaluate ?? "", sufix];
	}
}
