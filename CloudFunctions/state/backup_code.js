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
}
// [END functions_pubsub_subscribe]

function createEntity (jsonData){
    const transaction = datastore.transaction();
    var valveStatusKey = manifold_key + "." + station_num + "." + valve_sn;
    var valveAlertKey_pFault = valve_sn + "." + TYPE_PRESSURE_FAULT;
    var valveAlertKey_leak = valve_sn + "." + TYPE_LEAK;
    var valveAlertKey_CCL = valve_sn + "." + TYPE_C_THRESH_FAULT;
    var cclExceeded = (jsonData.cc > jsonData.ccl)? true:false;
    var isPressureFault_notReported = (jsonData.p_fault == 'N')?true:false;
    var isLeak_notReported = (jsonData.leak=='N')?true:false;

    return transaction.run()
        // fetch valve status entity
        .then (()=>transaction.key(KIND_VALVE_STATUS, valveStatusKey))
        .then((results)=> {
            const retrieved_key = results[0];
            // If valve status entity exists
            if(retrieved_key){
                //update
            }else{
                // Insert valve status
                return transaction.save(createValveStatusEntity(retrieved_key, jsonData));
            }
        })

        // fetch valveAlert for pressure fault
        .then (()=>transaction.key(KIND_VALVE_ALERT, valveAlert_pFault))
        .then((results)=> {
            const retrieved_key = results[0];
            //case1: if valve_sn.alert_type exists && p_fault =='N'
            if(retrieved_key && isPressureFault_notReported){
                return transaction.delete(retrieved_key);
            }
            //case2: if valve_sn.alert_type does not exist && p_fault = 'H' or 'L'
            else if(!retrieved_key && !isPressureFault_notReported){
                return transaction.save(createValveStatusEntity(jsonData,TYPE_PRESSURE_FAULT));
            }
            //Case3: if valve_sn.alert_type exists && p_fault = 'H' or 'L'
            else if(retrieved_key && !isPressureFault_notReported){
                //update function

            }
            //Case4: if valve_sn.alert_type does not exist && p_fault == 'N'
            else{
                //Do Nothing
            }
        })

        .then(()=>
           transaction.commit())
        .catch(()=> transaction.rollback());
}

function createValveAlertEntity(jsonData, alert_type){
    if(alert_type==TYPE_PRESSURE_FAULT){
        key = valveAlertKey_pFault;
        description = ((jsonData.p_fault == 'H') ? "High":"Low") + " pressure fault detected";
    }else if(alert_type==TYPE_LEAK){
        key = valveAlertKey_leak;
        description = ((jsonData.leak == 'P') ? "Persistent":"\"C\"") + " leak detected";
    }else if(alert_type==TYPE_C_THRESH_FAULT){
        key = valveAlertKey_leak;
        description = "Cycle Count exceeded the the threshold (ccl) by " + (jsonData.cc-jsonData.ccl);
    }else{
        console.log("Error:Wrong alert type inputted");
    }
    const entity = {
        key: key,
        data: [
            {
                name: 'valve_sn',
                value: jsonData.valve_sn
            },
            {
                name: 'detection_time',
                value: new Date().getTime() //do a query for old time stamp
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
    return entity;
}

function createValveStatusEntity(jsonData, key){
    entity = {
        key: key,
        data: [
            {
                name: 'valve_sn',
                value: jsonData.valve_sn
            },
            {
                name: 'manifold_sn',
                value: jsonData.manifold_key
            },
            {
                name: 'station_num',
                value: jsonData.station_num
            },
            {
                name: 'update_time',
                value: new Date().getTime()
            },
            {
                name: 'input',
                value: jsonData.input
            },
            {
                name: 'cc',
                value: jsonData.cc
            },
            {
                name: 'pp',
                value: jsonData.pp
            },
            {
                name: 'ccl',
                value: jsonData.ccl
            },
            {
                name: 'p_fault',
                value: jsonData.p_fault
            },
            {
                name: 'leak',
                value: jsonData.leak
            }
        ]
    };
    return entity;
}

// [START createEntity]
function createEntity2 (jsonData) {
    const transaction = ds.transaction();
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
                        value: new Date().getTime()
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
            addEntity(transaction, entity); //Insert-1

            //I. Pressure faults processing
            var num_of_matching_pressure_alerts = -1;

            const pressure_query = transaction.createQuery(KIND_VALVE_ALERT)
                .filter('valve_sn', '=', valve_sn)
                .filter('alert_type', '=', TYPE_PRESSURE_FAULT);

            transaction.runQuery(pressure_query)
                .then((results) => {
                    // alert entities found.
                    const entities = results[0];
                    entities.forEach((entity) => console.log(entity));
                    //Check for pressure faults if not exist
                    if(entities.length==0){
                        console.log("Createing a pressure alert record...");
                        addAlertEntity(transaction, TYPE_PRESSURE_FAULT, valve_sn, ((p_fault == 'H') ? "High":"Low") + " pressure fault detected"); //Insert 2.1
                    }else if(p_fault=='N'){
                        //delete all vavle_sn.alert_type
                        deleteAlert (transaction, valve_sn, TYPE_PRESSURE_FAULT); //Delete 2.2
                    }else{
                        //update if it is an existing alert
                        updateEntity (transaction, valve_sn, TYPE_PRESSURE_FAULT, "Update:" +((p_fault == 'H') ? "High":"Low") + "pressure fault detected"); // Update 2.3
                    }
                }
            );

            //II. Leak failures processing
            var num_of_matching_leak_alerts = -1;

            const leak_query = transaction.createQuery(KIND_VALVE_ALERT)
                .filter('valve_sn', '=', valve_sn)
                .filter('alert_type', '=', TYPE_LEAK);

            transaction.runQuery(leak_query)
                .then((results) => {
                    // alert entities found.
                    const entities = results[0];
                    entities.forEach((entity) => console.log(entity));
                    //Check for leak faults if not exist
                    if(entities.length==0){
                        console.log("Createing a leak alert record...");
                        addAlertEntity(transaction, TYPE_LEAK, valve_sn, ((leak == 'P') ? "Persistent":"\"C\"") + " leak detected");
                    }else if(leak=='N'){
                        //delete all vavle_sn.alert_type
                        deleteAlert (transaction, valve_sn, TYPE_LEAK);
                    }else{
                        //update if it is an existing alert
                        updateEntity (transaction, transaction, valve_sn, TYPE_LEAK, "Update:" + ((leak == 'P') ? "Persistent":"\"C\"") + " leak detected");
                    }
                }
            );

            //III. Check for cycle count limit exceed failures
            if(cc>ccl){
                //TODO: add a c_thresh alert

                var num_of_matching_alerts = -1;

                const query = transaction.createQuery(KIND_VALVE_ALERT)
                .filter('valve_sn', '=', valve_sn)
                .filter('alert_type', '=', TYPE_C_THRESH_FAULT);

                transaction.runQuery(query)
                    .then((results) => {
                        // alert entities found.
                        const entities = results[0];

                        console.log("results.length:"+results.length);
                        console.log("results[1]:"+results[1]);
                        console.log('Entities:');
                        entities.forEach((entity) => console.log(entity));
                        num_of_matching_alerts = entities.length;
                        console.log("num_of_matching_alerts:"+entities.length);
                        if(entities.length==0){
                            console.log("Createing a record...");
                            addAlertEntity(transaction, TYPE_C_THRESH_FAULT, valve_sn, "Cycle Count exceeded the the threshold (ccl) by " + (cc-ccl));
                            //addAlertEntity(TYPE_C_THRESH_FAULT, valve_sn, "Cycle Count exceeded the the threshold (ccl) by " + (cc-ccl));
                        }else{
                            //update if it is an existing alert
                            updateEntity (transaction, transaction, valve_sn, TYPE_C_THRESH_FAULT, "Update:Cycle Count exceeded the the threshold (ccl) by " + (cc-ccl));
                        }
                    }
                );
            }
        }
    }
    /*.catch()
        transaction.rollback();
        return;
    }
    transaction.commit();*/
//}
//[END createEntity]

//[START createAlertEntity]
function addAlertEntity(transaction, alert_type, valve_sn, description){
    var entityKey = valve_sn + "." + alert_type;
    var request_for_key = JSON.parse("{\"kind\":\"".concat(KIND_VALVE_ALERT).concat("\", \"key\":\"").concat(entityKey).concat("\"}"));
    const key = getKeyFromRequestData(request_for_key);

    //const key = datastore.key(KIND_VALVE_ALERT);
    console.log("key_query: "+key.name);
    const entity = {
        key: key,
        data: [
            {
                name: 'valve_sn',
                value: valve_sn
            },
            {
                name: 'detection_time',
                value: new Date().getTime() //do a query for old time stamp
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
    addEntity(transaction, entity);
}
//[END createAlertEntity]

// [START update_entity]
function updateEntity (transaction, valve_sn, alert_type, description) {
    const retrieved_key = transaction.key([
        KIND_VALVE_ALERT,
        valve_sn + '.' + alert_type
    ]);
    console.log("retrieved_keyID: "+retrieved_key.name);
    transaction.run()
        .then(() => transaction.get(retrieved_key))
        .then((results) => {
            const retrieved_entity = results[0];
            retrieved_entity.description = description;
            console.log("retrieved_entity.description:"+retrieved_entity.description);
            console.log("description:"+description);
            transaction.save({
            key: retrieved_key,
            data: retrieved_entity
            });
        }
    );
}
// [END update_entity]

// [START delete_entity]
function deleteAlert (transaction, valve_sn, alert_type) {
    const retrieved_key_del = transaction.key(
        [
            KIND_VALVE_ALERT,
            valve_sn + '.' + alert_type
        ]
    );
    transaction.delete(retrieved_key_del)
}
// [END delete_entity]

// [START addEntity]
function addEntity (transaction, entity) {
    transaction.save(entity);
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

  return transaction.key([requestData.kind, requestData.key]);
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
        }
    );
};