require('constants')
require('prototype.creep');
require('prototype.spawn');
require('prototype.tower');
require('prototype.flag');
require('prototype.RoomPosition');

module.exports.loop = function () {
  // Stats object for Grafana
  if (!Memory.stats) {
    Memory.stats = {
      cpu: {},
      gcl: {},
      rcl: {}
    }
  }
  if (!Memory.stats.remoteMining) {
    Memory.stats.remoteMining = {}
  }

  // Remove dead creep's memory
  for(let name in Memory.creeps) {
    if(!Game.creeps[name]) {
        delete Memory.creeps[name];
        console.log(`Arrange funeral for ${name}`);
    }
  }
  // Remove non-existent flag's memory
  for(let name in Memory.flags) {
    if(!Game.flags[name]) {
      delete Memory.flags[name];
      console.log(`Remove ${name} flag from record`);
    }
  }

  // Village System: keep info about a room in the object
  for (const rn in Game.rooms) {
    villages[rn] = new VillageCentre(rn)
  }

  // Flags System
  for (const name in Game.flags) {
    let flag = Game.flags[name]
    flag.processFlag()
  }

  // Main Loop
  for (const rn in Game.rooms) {
    let village = villages[rn]

    // Check sources
    for (const source of village.sources) {
      let enemiesInRange = source.pos.findInRange(FIND_HOSTILE_CREEPS, 5)
      let hostileStructures = source.pos.findInRange(FIND_HOSTILE_STRUCTURES, 5)
      if (enemiesInRange.length || hostileStructures.length) {
        continue;
      }

      // Check if source has container
      if (village.room.energyCapacityAvailable >= 550) {
        let hasContainer = source.pos.findInRange(FIND_STRUCTURES, 1, {filter: {structureType: STRUCTURE_CONTAINER}})
        let hasContainerSite = source.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 1, {filter: {structureType: STRUCTURE_CONTAINER}})
        if (!hasContainer.length && !hasContainerSite.length) {
          let spawn = source.pos.findClosestByPath(FIND_MY_SPAWNS)
          let tile = source.pos.findPathTo(spawn, {ignoreCreeps: true})[0]
          source.room.createConstructionSite(tile.x, tile.y, STRUCTURE_CONTAINER)
          console.log(`Place container at [${tile.x}, ${tile.y}] for source #${source.id}`);
        }
      }
    }

    // Assign work to free creeps
    village.assignments = _.sortBy(village.assignments, (a) => a.priority)
    let freeCreeps = _.filter(village.creeps, (c) => !c.memory.assignment)
    for (let creep of freeCreeps) {
      creep.getAssignment()
    }

    // Assign order to free spawns
    let spawnOrders = _.sortBy(village.spawnOrders, (s) => s.priority)
    let freeSpawns = _.filter(village.spawns, (s) => !s.spawning)
    for (let spawn of freeSpawns) {
      for (const order of spawnOrders) {
        if (spawn.enoughEnergyToSpawn(order.body)) {
          _.remove(spawnOrders, (e) => e == order)
          let result = spawn.spawnCreep(order.body, order.name, order.opts)

          // Add to a remote mining room upkeep
          if (result == OK) {
            console.log(`Hiring ${order.name} from village ${village.name}.`);
            let remoteRooms = []
            for (const name in Game.flags) {
              if (Game.flags[name].color == COLOR_YELLOW) {
                remoteRooms.push(Game.flags[name].pos.roomName)
              }
            }
            if (order.opts.memory.assignment && remoteRooms.includes(order.opts.memory.assignment.room)) {
              Memory.stats.remoteMining[order.opts.memory.assignment.room].upkeep += spawn.calcCreepCost(order.body)
              console.log(`${order.name} adding cost of ${spawn.calcCreepCost(order.body)} to the remote room: ${order.opts.memory.assignment.room}`);
              break;
            }
          }
        }
      }
    }
  }
  // Activate towers
  let towers = _.filter(Game.structures, {structureType: STRUCTURE_TOWER})
  for (const tower of towers) {
    tower.guardRoom()
  }
  // Activate creeps
  for (let name in Game.creeps){
    let creep = Game.creeps[name];
    if (!creep.spawning && creep.memory.assignment) creep.wakeUp();
  }
  let creep = Game.getObjectById('5cfecf1efcfc4d09d8f49eb0')
  if (creep) {
    // sign(creep)
  }

  // Log CPU to Grafana
  Memory.stats.cpu = {
    used: Game.cpu.getUsed(),
    bucket: Game.cpu.bucket
  };
  // GCL Stats
  Memory.stats.gcl.level = Game.gcl.level;
  Memory.stats.gcl.progress = Game.gcl.progress;
  Memory.stats.gcl.progressTotal = Game.gcl.progressTotal;
  // RCL Stats
  for (const room in Game.rooms) {
    let controller = Game.rooms[room].controller
    if (controller && controller.my) {
      Memory.stats.rcl[room] = {}
      Memory.stats.rcl[room].level = controller.level
      Memory.stats.rcl[room].progress = controller.progress
      Memory.stats.rcl[room].progressTotal = controller.progressTotal
    }
  }
};

// Good Room: E7S33  [E1S31, E5S31]
//            W27S13 [W29S13. W28S14, W28S15]

// TODO: ** Find a way to remove assignment once its done.
//       ** Rank build priority based on % to finish
//       Creep choosing source for harvest also see if other creeps about to finish harvesting
//       ** Farmer creep to do container harvesting
//       ** Spawning code for Peasant
//       ** Spawning condition for Farmer
//       ** Auto place source container site when room.energyCapacityAvailable >= 550
//       ** Keep source container in village and allow creep to take energy from it
//       ** creep getEnergy target priority system (all potential energy supplies in the same array, sort by priority)
//       * Auto adjust Peasant size
//       Phase out Peasant around RCL3
//       ** Assignment system where creep/spawn pick their work from prefered list.
//       ** Caravan creep to do the energy transfers
//       Inter-room code for caravan
//       Craftsman creep to do the building and repair
//       Cultist - decicated upgrader
//       Prospector creep for remote harvest
//       Auto creep balance system
//       ** Repair assignment at 75% hits and repair to 100% for road/container.
//       Improve creep supply job, creep will select assignment based on nearest.
//       Better spawnOrder priority system
//       Dequeue system for ongoing assignment. ie extension waiting an ongoing creep wont give out new assignment.
//       ** Check if building is missing and update the memory
//       Flag System:
//          Flag [yellow/any] on a source in a room for remote harvest
//          ** Flag [purple] on controller to reserve(purple)/claim(red)
//          ** Flag [green/any] on a construction site to send builder from other room
//          ** Flag [red/any] send military creep to remove all hostile structures



function sign(creep){
  let routes = Game.map.findRoute(creep.room, 'W33S2')
  if (routes.length) {
    const exit = creep.pos.findClosestByRange(routes[0].exit)
    creep.say(`Iä! Iä!`, true)
    creep.moveTo(exit, {visualizePathStyle: {stroke: '#1E775C'}})
  }
  else {
    let result = creep.signController(creep.room.controller, `Iä! Iä! Cthulhu fhtagn! Ph'nglui mglw'nfah Cthulhu R'lyeh wgah'nagl fhtagn!`)
    if (result == ERR_NOT_IN_RANGE) {
      creep.say(`Iä! Iä!`, true)
      creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#1E775C'}})
    }
  }
}
