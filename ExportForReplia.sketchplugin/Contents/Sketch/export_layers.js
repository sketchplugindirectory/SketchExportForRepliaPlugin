//  Export for Replia Skecth plugin.
//  export_layers.js
//
//  Created by Hirobe Kazuya on 2015/06/01.
//  Copyright (c) 2015 Bunguu.
//


var _layerIdGenerator = 1;
// -- Utils
var _documentTop = 0;
var _documentLeft = 0;
var _documentWidth = 0;
var _documentHeight = 0;
var _importScale = 1.0;
var _context;

function exportForReplia(context) {
	_context = context;
	var doc = context.document;

	var app = [NSApplication sharedApplication];

	var filePaths = [];

	var selectedLayers = doc.selectedLayers();
	if ([selectedLayers count]==0) {
		showAlert("No layers are selected. Please select the artboard or layers before exporting.");
		return;
	}

	var selectedRect = calcSelectedRect();
	_documentLeft = selectedRect[0];
	_documentTop = selectedRect[1];
	_documentWidth = selectedRect[2];
	_documentHeight = selectedRect[3];
	var importScale = selectImportScale(_documentWidth,_documentHeight);
	if (importScale<0) {
		return;
	}

	var savePath = pickFolder();
	if (savePath) {
		exportSelectedLayers(savePath+'/',importScale);
	}

}

function pickFolder(baseFolder){
	var panel = [NSSavePanel savePanel];
	[panel setNameFieldStringValue:"export.repliaImp"];
	panel.setCanCreateDirectories(true);

	panel.setAllowedFileTypes(["repliaImp"]);
	panel.setCanSelectHiddenExtension(true);

	var button = panel.runModal();
	if (button == NSFileHandlingPanelOKButton){
		return [[panel URL] path];
	}else{
		return null;
	}
}

var _progressCount = 0;
function showProgress() {
	var doc = _context.document
	if (_progressCount<0) {
	    [doc showMessage:null];
	}else{
	    [doc showMessage:"Exporting ..."];
	}
}

function showAlert(msg){
	var app = [NSApplication sharedApplication];
  [app displayDialog:msg withTitle:"Export for Replia"]
}

function createSelect(msg, items, selectedItemIndex){
  selectedItemIndex = selectedItemIndex || 0

  var accessory = [[NSComboBox alloc] initWithFrame:NSMakeRect(0,0,200,25)]
  [accessory addItemsWithObjectValues:items]
  [accessory selectItemAtIndex:selectedItemIndex]

  var alert = [[NSAlert alloc] init]
  [alert setMessageText:msg]
  [alert addButtonWithTitle:'OK']
  [alert addButtonWithTitle:'Cancel']
  [alert setAccessoryView:accessory]

  var responseCode = [alert runModal]
  var sel = [accessory indexOfSelectedItem]

  return [responseCode, sel]
}

function selectImportScale(documentWidth,documentHeight) {
	var message = "Export for Replia\n\n";
	message += "Selected layers size is "+documentWidth+"x"+documentHeight+"px.\n";
	message += "Please select import scale.";
	var options = ['100%', '50% (for @2x)', '33.3% (for @3x)']
	var values = [1.0, 2.0, 3.0];

	var choice = createSelect(message ,options, prefferdScaleIndex(documentWidth))
	if (choice[0]!=1000) {
		//canceled
		return -1.0;
	}
	var selected = choice[1];
	return values[selected];
}

function prefferdScaleIndex(width) {
	if (width == 320 || width == 375 || width == 768 || width == 1024) {
		return 0;
	}else if (width == 640 || width == 750 || width == 828 || width == 768*2 || width == 1024*2) {
		return 1;
	}else if (width == 1242) {
		return 2;
	}
	return 0;
}

function calcSelectedRect() {
	var doc = _context.document
	var page = [doc currentPage];
	var pageChildren = [page children];
	var dLeft,dTop,dRight,dBottom;

	for (var i=0; i<[pageChildren count];i++) {
		var layer = [pageChildren objectAtIndex:i];
		if (layer.isSelected()) {
			var rect = layer.absoluteRect();
			if (dLeft === undefined || dLeft > rect.x()) {
				dLeft  = rect.x();
			}
			if (dTop === undefined || dTop > rect.y()) {
				dTop  = rect.y();
			}
			if (dRight === undefined || dRight < rect.x()+rect.width()) {
				dRight  = rect.x()+rect.width();
			}
			if (dBottom === undefined || dBottom < rect.y()+rect.height()) {
				dBottom  = rect.y()+rect.height();
			}
		}
	}
	_documentLeft = dLeft;
	_documentTop = dTop;
	var documentWidth = dRight - dLeft;
	var documentHeight = dBottom - dTop;

	return [dLeft,dTop,documentWidth,documentHeight];
}

function exportSelectedLayers(folderPath,importScale) {
	_importScale = importScale;

	// if folder exists then remove it
	var fileManager = [NSFileManager defaultManager];
	if ([fileManager fileExistsAtPath:folderPath]) {
		[fileManager removeItemAtPath:folderPath error:null];
	}


	var doc = _context.document
	var page = [doc currentPage];
	var workPage = [page copy]
	workPage.setName([page name] + " temporary:");

	var pageChildren = [page children];
	var workChildren = [workPage children];

	var workLayers = [];
	for (var i=0; i<[pageChildren count];i++) {
		if ([pageChildren objectAtIndex:i].isSelected()) {
			workLayers.push([workChildren objectAtIndex:i]);
		}
	}

	var layers = [];
	var jsons = [];
	_layerIdGenerator = 1;

	_progressCount = 0;
	showProgress();
	for (var i=0; i < workLayers.length; i++)
	{
		var layer = workLayers[workLayers.length - i -1];
		var layerJson = (walksThrough(layer,folderPath));

		jsons.push(layerJson);
	}

	var json = {};
	json['importScale'] = importScale;
	json['sourceApplication'] = 'Sketh 3';
	json['resolution'] = 72;

	if (jsons.length == 1) {
		json['layers'] = jsons[0]['layers'];
		json['bounds'] = json['bounds'];
	}else {
		json['layers'] = jsons;
		json['bounds'] = json['layers'][0]['bounds'];

	}
	json['bounds'] = {'left':0,'top':0,'right':_documentWidth,'bottom':_documentHeight};


	// walk throw artboard
	var jsonText = ""+ JSON.stringify( json, undefined, 2);
	var path = folderPath+'psdInfo.json';


	var writeString = [NSString stringWithFormat:"%@", jsonText];
	[writeString writeToFile:path
							atomically:true
							encoding:NSUTF8StringEncoding
							error:null];

	var editJson = walkEditJson(json);
	var writeEditJsonString = [NSString stringWithFormat:"%@",  JSON.stringify( editJson, undefined, 2)];
	[writeEditJsonString writeToFile:folderPath+'edited.json'
												atomically:true
												encoding:NSUTF8StringEncoding
												error:null];

	_progressCount = -1;
	showProgress();

}

function walkEditJson(json) {
	var editJson = {};

	if (json && json['pngName']) {
		editJson['needsImage'] = 'complete';
	}
	//editJson['layerId'] = json['id'];

	var children = json['layers'];
	if (children) {
		editJson['children'] = [];
		for (var i=children.length-1;i>=0;i--) {

			editJson['children'].push(walkEditJson(children[i]));
		}
	}

	return editJson;
}

function outputLayerAsImage(layer,folderPath,index) {

	outputLayerAsPngWithScale(layer,folderPath+index,2,"@2x.png");
	outputLayerAsPngWithScale(layer,folderPath+index,3,"@3x.png");
}

function outputLayerAsPngWithScale(layer,path,scaleValue,suffix){

	// Clear all exportable sizes
  var exportSizes = [[layer exportOptions] sizes];
  while([exportSizes count] > 0) {
    [[exportSizes firstObject] remove]
  }

  var size = [[layer exportOptions] addExportSize]
  [size setFormat:"png"]
  [size setScale:scaleValue/ _importScale]
  [size setName:""]

	var doc = _context.document;
	[[doc currentPage] deselectAllLayers]
  [layer select:true byExpandingSelection:true]

  var rect = [layer absoluteInfluenceRect];
  var slices = [MSSliceMaker slicesFromExportableLayer:layer inRect:rect];

	[doc saveArtboardOrSlice: slices[0] toFile: path+suffix];
}

function walksThrough(layer,folderPath,parentJson) {
	//print(layer.treeAsDictionary());

	var json = {};

	json['id'] = _layerIdGenerator;
	_layerIdGenerator += 1;

	json['blendOptions'] = {};

	var isRectView = false;

	json['name'] = ""+layer.name();
	json['bounds'] = parseFrame(layer,parentJson);
	json['clipped'] = false;
	json['visible'] = true;


	if ([layer isMemberOfClass:[MSTextLayer class]])
	{
		outputLayerAsImage(layer,folderPath,json['id']);
		json['needsImage'] = 'complete';

		json['type'] = 'textLayer';
		json['boundsWithFX'] = parseImageFrame(layer,parentJson);

		var textItem = {};
		var str = ""+[layer stringValue];
		str = str.replace(/\n/g, '\r');

		textItem['textKey'] = str;
		textItem['boundingBox'] = {'left':0,'top':0,
			'right':json['bounds'].right-json['bounds'].left,
			'bottom':json['bounds'].bottom-json['bounds'].top};
		textItem['bounds'] = textItem['boundingBox'];

		var textColor = layer.textColor();
		var fillColor = parseFillColor(layer);
		if (fillColor) {
			textColor = fillColor;
		}

		var alpha = parseAlpha(layer,textColor);
		if (alpha && alpha < 100.0) {
			json['blendOptions']['opacity'] = {'value':alpha};
		}

		var textStyle = {};
		textStyle['size'] = layer.fontSize();
		textStyle['fontName'] = ""+layer.fontPostscriptName(); // nsfontを作って取得するべき
		textStyle['fontPostScriptName'] = ""+layer.fontPostscriptName();
		textStyle['color'] = parseColor(textColor);
		textStyle['leading'] = /*layer.fontSize() +*/ layer.lineSpacing();

		textStyle['isTunedBox'] = true

		textItem['textStyleRange'] = [{'textStyle':textStyle}];

		json['text'] = textItem;

	}else if ([layer isKindOfClass:[MSRectangleShape class]])
	{
		json['type'] = 'shapeLayer';
		json['boundsWithFX'] = parseImageFrame(layer,parentJson);

		outputLayerAsImage(layer,folderPath,json['id']);
		json['needsImage'] = 'complete';

		var fillColor = parseFillColor(layer);
		if (fillColor) {
			json['fill'] = {'color':parseColor(fillColor)),
											'class':'solidColorLayer'};
		}
		var alpha = parseAlpha(layer,fillColor)
		if (alpha && alpha < 100.0) {
			json['blendOptions']['opacity'] = {'value':alpha};
		}

	}else if ([layer isKindOfClass:[MSBitmapLayer class]]||
						[layer isKindOfClass:[MSShapePathLayer class]])
	{
		json['type'] = 'shapeLayer';
		json['pngName'] = ""+layer.name();
		json['boundsWithFX'] = parseImageFrame(layer,parentJson);

		outputLayerAsImage(layer,folderPath,json['id']);
		json['needsImage'] = 'complete';
	}else if ([layer isKindOfClass:[MSShapeGroup class]])
	{
		json['type'] = 'shapeLayer';
		json['boundsWithFX'] = parseImageFrame(layer,parentJson);
		var isImage = true;

		outputLayerAsImage(layer,folderPath,json['id']);
		json['needsImage'] = 'complete';

		// fillsが複数あるなら、imageにすべき？
		var fillColor = parseFillColor(layer);
		if (fillColor) {
			json['fill'] = {'color':parseColor(fillColor)),
											'class':'solidColorLayer'};
		}
		var alpha = parseAlpha(layer,fillColor)
		if (alpha && alpha < 100.0) {
			json['blendOptions']['opacity'] = {'value':alpha};
		}


		var layers = [layer layers];
		if ([layers count]==1 &&
				[[layers objectAtIndex:0] isKindOfClass:[MSRectangleShape class]])
		{
			isImage = false;
			isRectView = true;
		}


		if (isImage) {
			json['pngName'] = ""+layer.name();
		}

		if (layer.style()) {
			var style = layer.style();
			var borders = style.borders(); // MSStyleBorderCollection
			if ([borders count]>0) {
				var border = [borders objectAtIndex:0]; // MSStyleBoder
				var borderColor = parseColor(border.color());
				var borderWidth = border.thickness();
				var position = border.position(); // 0:center, 1:Inside, 2:Outside
				var isEnabled = border.isEnabled(); // 1:checked
				if (isEnabled || borderColor["alpha"]>0.0) {

					var scale = 1.0;
					if (position == 1) {
						/*
						json['bounds']['top'] += borderWidth/2.0 /scale;
						json['bounds']['left'] += borderWidth/2.0 /scale;
						json['bounds']['bottom'] -= borderWidth/2.0 /scale;
						json['bounds']['right'] -= borderWidth/2.0 /scale;
						*/
					}else if (position == 2) {

						json['bounds']['top'] -= borderWidth/1.0 /scale ;
						json['bounds']['left'] -= borderWidth/1.0 /scale;
						json['bounds']['bottom'] += borderWidth/1.0 /scale;
						json['bounds']['right'] += borderWidth/1.0 /scale;

					}else if (position == 0) {
						json['bounds']['top'] -= borderWidth/2.0 /scale ;
						json['bounds']['left'] -= borderWidth/2.0 /scale;
						json['bounds']['bottom'] += borderWidth/2.0 /scale;
						json['bounds']['right'] += borderWidth/2.0 /scale;

					}

					json['strokeStyle'] = {
						'strokeStyleContent':{'color':borderColor},
						'strokeStyleLineWidth':borderWidth,
						'strokeStyleOpacity':{'value':borderColor['alpha']*100.0}
					};

				}
			}
		}

	}else if ([layer isKindOfClass:[MSLayerGroup class]])
	{

	}else {

	}

	if (json['pngName']) {
		json['bounds'] = json['boundsWithFX'];
	}

	if (isRectView==false && !json['pngName'] &&
			([layer isKindOfClass:[MSLayerGroup class]] ||
						[layer isKindOfClass:[MSShapeGroup class]]))
	{
		outputLayerAsImage(layer,folderPath,json['id']);
		json['needsImage'] = 'complete';

		var layers = [layer layers];

		var jsons = [];
		for (var i=0; i < [layers count]; i++)
		{
			var childLayer = [layers objectAtIndex:[layers count]-i-1];
			jsons.push(walksThrough(childLayer,folderPath,json));
		}
		json['layers'] = jsons;
	}

	_progressCount +=1;
	showProgress();
	return json;
}

function parseFillColor(layer) {
	if (!layer['style']) return null;

	var fill = layer.style().fills().firstObject();
	var fillCount = layer.style().fills().count();
	var fillColor;
	if (fill) {
		// fill (0), gradient (1) or pattern (4
		if (fill.fillType() == 0) {
			fillColor = fill.color()
			return fillColor;
		}
	}
	return null;
}

function parseImageFrame(layer,parentJson) {
//	return parseFrameW(layer,parentJson,true);

	var rect = [layer absoluteInfluenceRect];

	var item = {};
	item.left = rect.origin.x;
	item.top = rect.origin.y;

	item.right = item.left + rect.size.width;
	item.bottom = item.top + rect.size.height;

	item.left = Math.round(item.left * 1000)/1000 - _documentLeft;
	item.top = Math.round(item.top * 1000)/1000 - _documentTop;
	item.right = Math.round(item.right * 1000)/1000 - _documentLeft;
	item.bottom = Math.round(item.bottom * 1000)/1000 - _documentTop;

	return item;
}

function parseFrame(layer,parentJson) {
	var rect = [layer absoluteRect]; //GKRect

	var item = {};

	item.left = rect.x();
	item.top = rect.y();

	item.right = item.left + rect.width();
	item.bottom = item.top + rect.height();

	item.left = Math.round(item.left * 1000)/1000 - _documentLeft;
	item.top = Math.round(item.top * 1000)/1000 - _documentTop;
	item.right = Math.round(item.right * 1000)/1000 - _documentLeft;
	item.bottom = Math.round(item.bottom * 1000)/1000 - _documentTop;

	return item;
}

function parseColor(color)
{
	var item = {};
  item.red = color.red()*255.0;
	item.green = color.green()*255.0;
	item.blue = color.blue()*255.0;
	item.alpha = color.alpha();
	return item;
}

function parseAlpha(layer,color) {
	if (!color) return 100.0;
	if (!layer['style']) return null;

	var alpha = 100.0;
	if (layer.style().contextSettings().opacity()) {
		alpha *= layer.style().contextSettings().opacity();
	}
	if (color) {
		alpha *= color.alpha();
	}
	return alpha;
}
