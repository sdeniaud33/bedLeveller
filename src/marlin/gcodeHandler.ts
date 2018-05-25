"use strict";

import { ICoords, IXYCoords } from "../types";
var SerialPort = require('serialport');

interface probeCallback { (coords: ICoords): void };

const OK_REGEXP = "^ok$";

class GCodeHandler {
	private comCtrl: any;
	private pendingSerial: string;

	private callbacksByResponse = {};

	private currentProbeCb: probeCallback;

	constructor(serialPort: string) {
		this.comCtrl = new SerialPort(
			serialPort,
			{
				baudRate: 250000,
			});
	}

	public init(): Promise<void> {
		return new Promise((resolve, reject) => {
			var _this = this;
			this.comCtrl.on('open', function (data: any) {
				console.log("Connected on " + this.port);
				_this.waitForResponse('echo:SD card').then(() => {
					_this.home().then(resolve).catch(reject);
				});
			});
			this.comCtrl.on('data', function (data: any) {
				_this.parseSerialData(data.toString());
			});
			this.comCtrl.on('error', function (data: any) {
				console.log("ERROR : " + data);
			});
		});
	}

	private waitForResponse(regExAsStr: string): Promise<RegExpExecArray> {
		return new Promise((resolve, reject) => {
			this.callbacksByResponse[regExAsStr] = resolve;
		});
	}

	private parseSerialData(cmd: string) {
		const self = this;
		var lastIdx = cmd.lastIndexOf('\n');
		if (lastIdx === -1) {
			this.pendingSerial += cmd;
			return;
		}
		this.pendingSerial += cmd.substr(0, lastIdx);
		var cmds = this.pendingSerial.split('\n');
		this.pendingSerial = cmd.substr(lastIdx + 1);
		cmds.forEach((cmd) => {
			console.log("Parse : " + cmd);
			Object.keys(self.callbacksByResponse).forEach((regExAsStr: string) => {
				const regEx = new RegExp(regExAsStr);
				const match: RegExpExecArray = regEx.exec(cmd);
				if (match) {
					self.callbacksByResponse[regExAsStr](match);
					delete self.callbacksByResponse[regExAsStr];
				}
			});
		});
	}

	public sendGCode(gcode: string, expectedRegexResponse?: string): Promise<RegExpExecArray> {
		return new Promise((resolve, reject) => {
			console.log("**** SEND ****", gcode);
			this.comCtrl.write(gcode + '\n');
			if (expectedRegexResponse)
				this.waitForResponse(expectedRegexResponse).then(resolve).catch(reject);
			else
				resolve();
		});
	}

	public sendGCodeWithPromise(gcode: string, expectedRegexResponse: string = OK_REGEXP): Promise<void> {
		return new Promise((resolve, reject) => {
			this.sendGCode(gcode, expectedRegexResponse).then((match: RegExpExecArray) => resolve).catch(reject);
		});
	}

	public goTo(coords: ICoords): Promise<void> {
		var gcode: string = "G0";
		if (coords.x)
			gcode += ' X' + coords.x;
		if (coords.y)
			gcode += ' Y' + coords.y;
		if (coords.z)
			gcode += ' Z' + coords.z;
		return this.sendGCodeWithPromise(gcode);
	}

	public home(): Promise<void> {
		return this.sendGCodeWithPromise('G28');
	}

	public autoLevel(): Promise<void> {
		return this.sendGCodeWithPromise('G29');
	}

	public storeToEprom(): Promise<void> {
		return this.sendGCodeWithPromise('M500');
	}

	public probe(coords?: IXYCoords): Promise<ICoords> {
		return new Promise((resolve, reject) => {

			function _exec() {
				this.sendGCode('G30', "^Bed X: (\d+\.\d+) Y: (\d+\.\d+) Z: (\d+\.\d+)$").then((match: RegExpExecArray) => {
					resolve({
						x: parseFloat(match[1]),
						y: parseFloat(match[2]),
						z: parseFloat(match[3]),
					});
				});
			}

			if (coords) {
				this.goTo({ x: coords.x, y: coords.y }).then(() => {
					_exec();
				});
			}
			else
				_exec();
		});
	}
}

export { GCodeHandler };