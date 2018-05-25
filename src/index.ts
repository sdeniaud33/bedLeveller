import { ICoords } from "./types";
import { GCodeHandler } from "./marlin/gcodeHandler";

"use strict";

var gcodeHandler = new GCodeHandler("COM16");
gcodeHandler.init().then(() => {
	gcodeHandler.goTo({ x: 80, y: 80 }).then(() => {
		gcodeHandler.probe().then((c: ICoords) => {
			console.log("X : " + c.x);
			console.log("Y : " + c.y);
			console.log("Z : " + c.z);
		});
	
	});
});

