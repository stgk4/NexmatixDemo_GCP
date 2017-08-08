/*
*
*
*Cloud function for subscribing to manifold-state topic for status
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

function createEntity(jsonData){
console.log("Entered createEntity...");
    var manifold_sn = jsonData.manifold_sn;
    for(var i = 0; i < jsonData.stations.length; i++){
            const transaction = datastore.transaction();
            console.log("Iteration: "+i);
            var station = jsonData.stations[i];

            const station_num = station.station_num;
            const valve_sn = station.valve_sn;

            var isCCLExceeded = (station.cc > station.ccl)? true:false;
            var isPressureFault_notReported = (station.p_fault == 'N')?true:false;
            var isLeak_notReported = (station.leak=='N')?true:false;

            var valveStatusKey = manifold_sn + "." + station_num + "." + valve_sn;
            var valveAlertKey_pFault = valve_sn + "." + TYPE_PRESSURE_FAULT;
            var valveAlertKey_leak = valve_sn + "." + TYPE_LEAK;
            var valveAlertKey_CCL = valve_sn + "." + TYPE_C_THRESH_FAULT;

            var retrieved_key_status = datastore.key([KIND_VALVE_STATUS, valveStatusKey]);
            var retrieved_key_alert_p_fault = datastore.key([KIND_VALVE_ALERT, valveAlertKey_pFault]);
            var retrieved_key_alert_leak = datastore.key([KIND_VALVE_ALERT, valveAlertKey_leak]);
            var retrieved_key_alert_c_thresh = datastore.key([KIND_VALVE_ALERT, valveAlertKey_CCL]);

            return transaction.run()
                // fetch valve status entity
                .then (()=>transaction.get(retrieved_key_status))
                .then((results)=> {
                    const retrieved_entity = results[0];
                    // If valve status entity exists
                    if(retrieved_entity){
                        //update
                        console.log("Updated a valve Status Entity with key:"+retrieved_key_status.name);
                        var entity = createValveStatusEntity(station, manifold_sn, retrieved_key_status);
                        return transaction.save(entity);
                    }else{
                        // Insert valve status
                        console.log("VStatusKey_retrieved:"+retrieved_key_status.name);
                        //console.log("Created a valve Status Entity with key:"+retrieved_key.name);
                        var entity = createValveStatusEntity(station, manifold_sn, retrieved_key_status);
                        return transaction.save(entity);
                    }
                })
                .then(()=> {
                   transaction.commit();
                   console.log("Transaction Committed");
                })
                .catch((exception)=> {
                    transaction.rollback();
                    console.log("Transaction Rolledback:"+exception);
                });
            }
    }

function createValveStatusEntity(jsonData, manifold_sn, key){
    message_time = new Date().getTime();
    entity = {
        key: key,
        data: [
           {
                name:"valve_sn", value:jsonData.valve_sn
           },
           {
                name:"manifold_sn", value:manifold_sn
           },
           {
                name:"station_num", value:jsonData.station_num
           },
           {
                name:"cc", value:jsonData.cc
           },
           {
                name:"ccl", value:jsonData.ccl
           },
           {
                name:"update_time", value:message_time
           },
           {
                name:"input", value:jsonData.input
           },
           {
                name:"pp", value:jsonData.pp
           },
           {
                name:"p_fault", value:jsonData.p_fault
           },
           {
                name:"leak", value:jsonData.leak
           }
        ]
    };
    console.log("Creating ValveStatusEntity..." + JSON.stringify(entity));
    return entity;
}

/*

gcloud beta functions deploy manifold-state-subscriber --entry-point subscribe --stage
  -bucket nexmatix-staging-bucket --trigger-topic manifold-state

 */
