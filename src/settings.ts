"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.Card;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

export class DataPointCardSettings extends FormattingSettingsCard {
    public fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Font Size",
        value: 12
    });

    public fontFamily = new formattingSettings.FontPicker({
        name: "fontFamily",
        displayName: "Font Family",
        value: "Segoe UI"
    });

    public fontColor = new formattingSettings.ColorPicker({
        name: "fontColor",
        displayName: "Font Color",
        value: { value: "black" }
    });

    public defaultStackedBarChart = new formattingSettings.ToggleSwitch({
        name: "convertToStackedBarChart",
        displayName: "Switch Chart",
        value: false
    });

    public showDataLabels = new formattingSettings.ToggleSwitch({
        name: "showDataLabels",
        displayName: "Data Labels",
        value: false
    });

    public showAxisLabels = new formattingSettings.ToggleSwitch({
        name: "showAxisLabels",
        displayName: "Axis Labels",
        value: false
    })

    public name: string = "dataCard";
    public displayName: string = "Data Card";
    public slices: FormattingSettingsSlice[] = [this.fontSize, this.fontFamily, this.fontColor, this.defaultStackedBarChart, this.showDataLabels, this.showAxisLabels];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    public dataPointCard: DataPointCardSettings = new DataPointCardSettings();
    public cards: formattingSettings.Card[] = [this.dataPointCard];
}