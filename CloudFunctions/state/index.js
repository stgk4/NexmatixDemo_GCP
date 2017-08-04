/*
*
*
*Cloud function for subscribing to manifold-state topic
*
*
*/


// Specifying datastore requirement in GCP project
const Datastore = require('@google-cloud/datastore');

// Instantiates a client
const datastore = Datastore();

//enums
const KIND_VALVE_STATUS = "ValveStatus"
const KIND_VALVE_ALERT = "ValveAlert"
const PRESSURE_FAULTS = ['H', 'L'];
const LEAKS = ['C', 'P'];
const TYPE_PRESSURE_FAULT = "p_fault";
const TYPE_LEAK = "leak";
const TYPE_C_THRESH_FAULT = "c_thresh";


// [START functions_pubsub_subscribe]
/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 *
 * @param {object} event The Cloud Functions event.
 * @param {object} event.data The Cloud Pub/Sub Message object.
 * @param {string} event.data.data The "data" property of the Cloud Pub/Sub Message.
 * @param {function} The callback function.
 */
exports.subscribe = function subscribe (event, callback) {
  const pubsubMessage = event.data;

  // We're just going to log the message to prove that it worked!
  const message = Buffer.from(pubsubMessage.data, 'base64').toString();
  
  console.log(message);
  
  var jsonData = JSON.parse(message);
  
  
  if (!jsonData) {
    throw new Error('message is empty!');
  }
  //parsing the message for updating/creating the Manifold kind entity
  createEntity(jsonData);

  // Don't forget to call the callback!
  callback();
};
// [END functions_pubsub_subscribe]

// [START createEntity]
function createEntity (jsonData) {
  var manifold_key = jsonData.manifold_sn;
  
  for(var i = 0; i < jsonData.stations.length; i++){
		var station = jsonData.stations[i];
		
		const station_num = station.station_num;
		const valve_sn = station.valve_sn;
		const input = station.input;
		const cc = station.cc;
		const pp = station.pp;
		const ccl = station.ccl;
		const p_fault = station.p_fault; 
		const leak = station.leak;
		
		var entityKey = manifold_key + "." + station_num + "." + valve_sn;
		var request_for_key = JSON.parse("{\"kind\":\"".concat(KIND_VALVE_STATUS).concat("\", \"key\":\"").concat(entityKey).concat("\"}"));
		const key = getKeyFromRequestData(request_for_key);
		
		entity = {
		key: key,
		data: [
			{
				name: 'valve_sn',
				value: valve_sn
			},
			{
				name: 'manifold_sn',
				value: manifold_key
			},
			{
				name: 'station_num',
				value: station_num
			},
			{
				name: 'update_time',
				value: new Date().toJSON()
			},
			{
				name: 'input',
				value: input
			},
			{
				name: 'cc',
				value: cc
			},
			{
				name: 'pp',
				value: pp
			},
			{
				name: 'ccl',
				value: ccl
			},
			{
				name: 'p_fault',
				value: p_fault
			},
			{
				name: 'leak',
				value: leak
			}
		]
		};

		//function to add entities
		addEntity(entity);
		
		//I. Check for pressure faults
		if(PRESSURE_FAULTS.includes(p_fault)){
			
			//TODO: add a pressure fault alert
			addAlertEntity(TYPE_PRESSURE_FAULT, valve_sn, ((p_fault == 'H') ? "High":"Low") + " pressure fault detected");
		}else{
			if(p_fault=='N'){
				//do nothing
			}else{
				console.log("PAYLOAD_ERROR: undefined p_fault value detected");
			}
		}
		
		//II. Check for leak failures
		if(LEAKS.includes(leak)){
			//TODO: add a leak alert
		}else{
			if(leak=='N'){
				//do nothing
				addAlertEntity(TYPE_LEAK, valve_sn, ((leak == 'P') ? "Persistent":"\"C\"") + " leak detected");
			}else{
				console.log("PAYLOAD_ERROR: undefined p_fault value detected");
			}
		}
		
		//III. Check for cycle count limit exceed failures
		if(cc>ccl){
			//TODO: add a c_thresh alert
			addAlertEntity(TYPE_C_THRESH_FAULT, valve_sn, "Cycle Count exceeded the the threshold (ccl) by " + (cc-ccl));
		}else{
			//do nothing
		}
	}
  }
//[END createEntity]

//[START createAlertEntity]
function addAlertEntity(alert_type, valve_sn, description){
		var alertKey = new Date().getTime();
		var request_for_key = JSON.parse("{\"kind\":\"".concat(KIND_VALVE_ALERT).concat("\", \"key\":\"").concat(alertKey).concat("\"}"));
		const key = getKeyFromRequestData(request_for_key);
		
		entity = {
		key: key,
		data: [
			{
				name: 'valve_sn',
				value: valve_sn
			},
			{
				name: 'detection_time',
				value: new Date().toJSON() //do a query for old time stamp
			},
			{
				name: 'alert_type',
				value: alert_type
			},
			{
				name: 'description',
				value: description 
			}
		]
		};

		//function to add entities
		addEntity(entity);
}
//[END createAlertEntity]

// [START addEntity]
function addEntity (entity) {
  datastore.save(entity)
    .then(() => {
      console.log(`an Entity ${entity.key.id} created successfully.`);
    })
    .catch((err) => {
      console.error('ERROR:', err);
    });
}
// [END add_entity]

/**
 * Gets a Datastore key from the kind/key pair in the request.
 *
 * @param {object} requestData Cloud Function request data.
 * @param {string} requestData.key Datastore key string.
 * @param {string} requestData.kind Datastore kind.
 * @returns {object} Datastore key object.
 */
function getKeyFromRequestData (requestData) {
  if (!requestData.key) {
    throw new Error('Key not provided. Make sure you have a "key" property in your request');
  }

  if (!requestData.kind) {
    throw new Error('Kind not provided. Make sure you have a "kind" property in your request');
  }

  return datastore.key([requestData.kind, requestData.key]);
}

/**
 * Creates and/or updates a record.
 *
 * @example
 * gcloud alpha functions call set --data '{"kind":"Task","key":"sampletask1","value":{"description": "Buy milk"}}'
 *
 * @param {object} req Cloud Function request context.
 * @param {object} req.body The request body.
 * @param {string} req.body.kind The Datastore kind of the data to save, e.g. "Task".
 * @param {string} req.body.key Key at which to save the data, e.g. "sampletask1".
 * @param {object} req.body.value Value to save to Cloud Datastore, e.g. {"description":"Buy milk"}
 * @param {object} res Cloud Function response context.
 */
exports.set = function set (req, res) {
  // The value contains a JSON document representing the entity we want to save
  if (!req.body.value) {
    throw new Error('Value not provided. Make sure you have a "value" property in your request');
  }

  const key = getKeyFromRequestData(req.body);
  const entity = {
    key: key,
    data: req.body.value
  };

  return datastore.save(entity)
    .then(() => res.status(200).send(`Entity ${key.path.join('/')} saved.`))
    .catch((err) => {
      console.error(err);
      res.status(500).send(err);
      return Promise.reject(err);
    });
};