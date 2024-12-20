/**
 * Copyright 2024 The Drasi Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const gremlin = require('gremlin');

// Facilities Client
const authenticator = new gremlin.driver.auth.PlainTextSaslAuthenticator(
  `/dbs/${process.env["FACILITIES_DB_NAME"]}/colls/${process.env["FACILITIES_CNT_NAME"]}`, process.env["FACILITIES_KEY"]
)

const client = new gremlin.driver.Client(
  process.env["FACILITIES_URL"],
  {
    authenticator,
    traversalsource: "g",
    rejectUnauthorized: true,
    mimeType: "application/vnd.gremlin-v2.0+json"
  }
);

async function GetRoomById(context, bid, fid, rid) {
  // context.log(`GetRoomById: ${JSON.stringify(rid)}`);

  const res = await client.submit(`g.V(bid).hasLabel("Building").in("PART_OF").hasLabel("Floor").hasId(fid).in("PART_OF").hasLabel("Room").hasId(rid)`,  { bid, fid, rid });
  const node = res.first();

  let roomName = node.properties?.name[0]?.value ?? "";
  let temp = node.properties?.temp[0]?.value ?? "";
  let humidity = node.properties?.humidity[0]?.value ?? "";
  let co2 = node.properties?.co2[0]?.value ?? "";
  let comfortLevel = Math.floor(50 + (temp - 72) + (humidity - 42) + (co2 > 500 ? (co2 - 500) / 25 : 0));
  if (node) {
    return {
      body: {
        id: node.id,
        buildingId: bid,
        floorId: fid,
        name: node.properties?.name[0]?.value ?? "",
        temp: node.properties?.temp[0]?.value ?? "",
        humidity: node.properties?.humidity[0]?.value ?? "",
        co2: node.properties?.co2[0]?.value ?? "",
        comfortLevel: comfortLevel
      }
    };
  } else {
    // TODO 
  }
}

async function GetAllRooms(context, bid, fid) {
  // context.log(`GetAllRooms`);

  const rooms = [];
  var readable = client.stream(`g.V(bid).hasLabel("Building").in("PART_OF").hasLabel("Floor").hasId(fid).in("PART_OF").hasLabel("Room")`, { bid, fid }, { batchSize: 100 });

  try {
    for await (const result of readable) {
      for (const node of result.toArray()) {
        const v = {
            id: node.id,
            buildingId: bid,
            floorId: fid,
            name: node.properties?.name[0]?.value ?? "",
            temp: node.properties?.temp[0]?.value ?? "",
            humidity: node.properties?.humidity[0]?.value ?? "",
            co2: node.properties?.co2[0]?.value ?? "",
            comfortLevel: node.properties?.comfortLevel[0]?.value ?? ""
          };
        rooms.push(v);
      }
    }
  } catch (err) {
    console.error(err.stack);
  }

  return {
    body: rooms
  };
}

module.exports = async function (context, req) {
  // context.log(`request: ${JSON.stringify(req)}`);

  var result = {};

  switch (req.method) {
    case "GET":
      if (req.params.rid) {
        result = await GetRoomById(context, req.params.bid, req.params.fid, req.params.rid);
      } else {
        result = await GetAllRooms(context, req.params.bid, req.params.fid);
      }
      break;
    default:
      break;
  }
  return result;
}