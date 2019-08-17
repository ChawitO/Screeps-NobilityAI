Flag.prototype.processFlag = function () {
  let base;
  let village = villages[this.pos.roomName];
  switch (this.color) {
    case COLOR_YELLOW:
      if (this.secondaryColor !== COLOR_WHITE) {
        // Remote harvest this source from nearest room
        if (!Memory.stats.remoteMining[this.pos.roomName]) {
          Memory.stats.remoteMining[this.pos.roomName] = {
            income: 0,
            upkeep: 0
          }
        }
        this.setBase(800)
        base = villages[this.memory.base]

        // make spawnOrder for the Farmer creep
        let assignedFarmers = _.sum(Game.creeps, (c) => c.memory.role == FARMER && c.memory.assignment && c.memory.assignment.flag == this.name)
        if (!assignedFarmers) {
          let id = undefined
          if (this.room) {
            let source = this.pos.lookFor(LOOK_SOURCES)[0]
            if (source) {
              id = source.id
            }
          }
          let order = {
            body: [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
            name: `Farmer-${Game.time % 1000}`,
            opts: {memory: {role: FARMER, type: 'civilian', energy: {}, assignment: {type: JOB.FARMING, id: id, flag: this.name, room: this.pos.roomName}}},
            priority: 120
          }
          base.spawnOrders.push(order)
        }
        // make spawnOrder for Caravan creep
        let container = undefined
        let source = undefined
        if (this.room) {
          source = this.pos.lookFor(LOOK_SOURCES)[0]
          container = this.pos.findInRange(FIND_STRUCTURES, 1, {filter: {structureType: STRUCTURE_CONTAINER}})[0]
        }
        if (container) {
          let energyPerTick = source.energyCapacity / 300
          let totalEnergyPerTrip = energyPerTick * this.memory.roundTripLength
          let totalCarryParts = Math.ceil(totalEnergyPerTrip / 50) // No safe margin for CARRY space yet
          let assignedCaravan = _.sum(Game.creeps, (c) => c.memory.assignment && c.memory.assignment.type == JOB.INTER_ROOM_TRANSFER && c.memory.assignment.id == container.id)
          if (assignedCaravan < 1) {
            let order = {
              body: getCaravanBody(totalCarryParts / 2),
              name: `Caravan-${Game.time % 1000}`,
              opts: {memory: {role: CARAVAN, type: 'civilian', energy: {}, base: this.memory.base, assignment: {type: JOB.INTER_ROOM_TRANSFER, id: container.id, flag: this.name, room: this.pos.roomName}}},
              priority: 130
            }
            base.spawnOrders.push(order)
          }
        }
        // Request builder creep if has construction sites
        if (village && village.constructionSites.length) {
          let assignedCreeps = _.sum(Game.creeps, (c) => c.memory.role == PEASANT && c.memory.assignment && c.memory.assignment.room == this.pos.roomName)
          if (assignedCreeps < 1) {
            let setCounts = Math.min(Math.floor(base.room.energyCapacityAvailable / 200), 5)
            let order = {
              body: getPeasantBody(setCounts),
              name: `Peasant-${Game.time % 1000}`,
              opts: {memory: {role: PEASANT, type: CIVILIAN, energy: {}, assignment: new Assignment(JOB.REMOTE_BUILD, village.constructionSites[0].id, this.pos.roomName)}},
              priority: 8
            }
            base.spawnOrders.push(order)
          }
        }
        // Request repairing creep if lots of damaged structures
        if (village) {
          let needRepair = _.filter(village.damagedStructures, (s) => s.hits / s.hitsMax < 0.20)
          if (needRepair.length) {
            let assignedWorkers = _.sum(Game.creeps, (c) => c.memory.role == PEASANT && c.memory.assignment && c.memory.assignment.room == this.pos.roomName)
            if (assignedWorkers < 1) {
              let setCounts = Math.min(Math.floor(base.room.energyCapacityAvailable / 200), 3)
              let order = {
                body: getPeasantBody(setCounts),
                name: `Peasant-${Game.time % 1000}`,
                opts: {memory: {role: PEASANT, type: CIVILIAN, energy: {}, assignment: new Assignment(JOB.REPAIR, needRepair[0].id, this.pos.roomName)}},
                priority: 110
              }
              base.spawnOrders.push(order)
            }
          }
        }
        // Send defender if under atttack
        if (village && village.hostileCreeps.length) {
          let assignedDefenders = _.sum(Game.creeps, (c) => c.memory.type == MILITARY && c.memory.assignment && c.memory.assignment.room == this.pos.roomName)
          if (assignedDefenders < village.hostileCreeps.length) {
            let order = {
              body: [TOUGH, TOUGH, TOUGH, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL],
              name: `Musketeer-${Game.time % 1000}`,
              opts: {memory: {role: RANGE, type: MILITARY, assignment: {type: JOB.ATTACK, id: this.name, flag: this.name, room: this.pos.roomName}}},
              priority: 001
            }
            base.spawnOrders.push(order)
            this.memory.underattack = Game.time
          }
        }
      }
      if (this.secondaryColor == COLOR_WHITE) {
        // Take energy from container/storage under this flag
        this.memory.base = this.name
        let storage = undefined
        if (this.room) {
          storage = this.pos.findInRange(FIND_STRUCTURES, 1, {filter: {structureType: STRUCTURE_STORAGE}})[0]
        }
        if (storage && storage.store.energy) {
          let assignedCaravan = _.sum(Game.creeps, (c) => c.memory.assignment && c.memory.assignment.id == storage.id)
          if (assignedCaravan < 4) {
            let order = {
              body: [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
              name: `Caravan-${Game.time % 1000}`,
              opts: {memory: {role: CARAVAN, type: 'civilian', energy: {}, base: this.memory.base, assignment: {type: JOB.INTER_ROOM_TRANSFER, id: storage.id, flag: this.name, room: this.pos.roomName}}},
              priority: 8
            }
            villages[this.memory.base].spawnOrders.push(order)
          }
        }
      }

      if (false) {
        let routes = this.getRoutes()

        if (!this.memory.roadPlaced) {
          // Ensure vision in all rooms
          let rooms = [...new Set(routes.path.map(pos => pos.roomName))];
          let hasVision = true;
          rooms.forEach(rn => {if(!Game.rooms[rn]) hasVision = false})

          if (hasVision) {
            // Place container
            routes.path[0].createConstructionSite(STRUCTURE_CONTAINER)
            // Place roads
            for (const pos of routes.path) {
              pos.createConstructionSite(STRUCTURE_ROAD)
            }
            this.memory.roadPlaced = true
          }
          console.log('hi1');
        }

        if (!this.memory.roundTripLength) {
          console.log('hi2');
          this.memory.roundTripLength = routes.path.length * 2
        }
      }



      break;
    case COLOR_PURPLE:
      if (this.secondaryColor == COLOR_RED) {
        // Do claim the controller from nearest room
        this.setBase(650)
        base = villages[this.memory.base]

        let conquistadors = _.sum(Game.creeps, (c) => c.memory.role == CONQUISTADOR && c.memory.assignment && c.memory.assignment.room == this.pos.roomName)
        let spawning = _.sum(Game.creeps, (c) => c.memory.role == CONQUISTADOR && c.room.name == base.name)
        if (!spawning && !conquistadors) {
          let order = {
            body: [CLAIM, MOVE],
            name: `Conquistador-${Game.time % 1000}`,
            opts: {memory: {role: CONQUISTADOR, type: CIVILIAN}},
            priority: 4
          }
          base.spawnOrders.push(order)
        }
        // Make assignment if no conquistador with the assignment
        if (!conquistadors) {
          base.assignments.push(new Assignment(JOB.CLAIM, undefined, this.pos.roomName))
        }
      }
      else if (this.secondaryColor == COLOR_PURPLE) {
        // Do reserve the controller from nearest room
        this.setBase(1300)

        base = villages[this.memory.base]
        let assignedCreeps = _.sum(Game.creeps, (c) => c.memory.assignment && c.memory.assignment.flag == this.name)
        let reserveTick = 0 //spawn only if reserveTick is < 3000
        if (this.room && this.room.controller.reservation) {
          reserveTick = this.room.controller.reservation.ticksToEnd
        }
        if (!assignedCreeps && reserveTick < 3000) {
          let order = {
            body: [CLAIM, CLAIM, MOVE, MOVE],
            name: `Colonialist-${Game.time % 1000}`,
            opts: {memory: {role: RESERVER, type: CIVILIAN, assignment: {type: JOB.RESERVE, id: this.name, flag: this.name, room: this.pos.roomName}}},
            priority: 160
          }
          base.spawnOrders.push(order)
        }
      }
      // Remove flag if that room has been claimed
      if (this.room && this.room.controller.my) {
        this.remove()
      }
      break;
    case COLOR_RED:
      if (this.secondaryColor !== COLOR_WHITE) {
        // Send military creeps to clear the room of hostile structures.
        this.setBase(390)
        base = villages[this.memory.base]

        let assignedCreeps = _.sum(Game.creeps, (c) => c.memory.type == MILITARY && c.memory.assignment && c.memory.assignment.room == this.pos.roomName)
        if (assignedCreeps < 2) {
          let order = {
            body: [ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE],
            name: `PeasantLevy-${Game.time % 1000}`,
            opts: {memory: {role: MELEE, type: MILITARY, assignment: {type: JOB.ATTACK, id: this.name, flag: this.name, room: this.pos.roomName}}},
            priority: 6
          }
          base.spawnOrders.push(order)
        }
        // Remove flag if no hostile structures
        if (village && !village.hostileStructures.length && !village.hostileCreeps.length) {
          this.remove()
        }
      }
      if (this.secondaryColor == COLOR_WHITE) {
        //user flag name as base room name
        this.memory.base = this.name
        base = villages[this.memory.base]
        let assignedCreeps = _.sum(Game.creeps, (c) => c.memory.type == MILITARY && c.memory.assignment && c.memory.assignment.id == this.name)
        let spawning = _.sum(Game.creeps, (c) => c.memory.type == MILITARY && c.room.name == base.name)
        if ((assignedCreeps + spawning) < 1) {
          let order = {
            body: [ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE],
            name: `PeasantLevy-${Game.time % 1000}`,
            opts: {memory: {role: MELEE, type: MILITARY, assignment: new Assignment(JOB.ATTACK, this.name, this.pos.roomName)}},
            priority: 6
          }
          base.spawnOrders.push(order)
        }
      }
      break;
    case COLOR_GREEN:
      // Send builder to the remote room
      this.setBase(600)
      base = villages[this.memory.base]

      let assignedCreeps = _.sum(Game.creeps, (c) => c.memory.assignment && c.memory.assignment.type == JOB.REMOTE_BUILD && c.memory.assignment.room == this.pos.roomName)
      let site
      if (this.room) {
        site = this.pos.lookFor(LOOK_CONSTRUCTION_SITES)[0]
      }
      if (site && assignedCreeps < 2) {
        let setCounts = Math.min(Math.floor(base.room.energyCapacityAvailable / 200), 5)
        let order = {
          body: getPeasantBody(setCounts),
          name: `Peasant-${Game.time % 1000}`,
          opts: {memory: {role: PEASANT, type: CIVILIAN, energy: {}, assignment: new Assignment(JOB.REMOTE_BUILD, site.id, this.pos.roomName)}},
          priority: 8
        }
        base.spawnOrders.push(order)
      }
      // Remove flag if no construction site
      if (this.room && !site) {
        this.remove()
      }
      break;
    case COLOR_WHITE:
      this.setBase(10) // Cant be zero since it can choose remote room
      this.getRoutes()
      break;
    default:
  }
}

Flag.prototype.getNearestCapableRoom = function (minimumRoomEnergyCapacity) {
  console.log(`using flag.getNearestCapableRoom(), dont use pls`);
  let candidateRooms = []
  let myRooms = _.filter(Game.rooms, (r) => r.controller && r.controller.my && r.find(FIND_MY_SPAWNS).length && r.energyCapacityAvailable >= minimumRoomEnergyCapacity)
  for (const room of myRooms) {
    candidateRooms.push({name: room.name, distance: Game.map.findRoute(this.pos.roomName, room).length})
  }
  let room = _.sortBy(candidateRooms, (r) => r.distance)[0]
  return room
};

Flag.prototype.setBase = function (minimumRoomEnergyCapacity) {
  if (!this.memory.base) {
    let rooms = _.filter(Game.rooms, (r) => r.energyCapacityAvailable >= minimumRoomEnergyCapacity)
    rooms.forEach(r => r.distance = Game.map.findRoute(this.pos.roomName, r).length)

    this.memory.base = _.sortBy(rooms, (r) => r.distance)[0].name
    console.log(`'${this.name}' marks ${this.pos.roomName} from base room: ${this.memory.base}`);
  }
};

Flag.prototype.getRoutes = function () {
  let start = this.pos
  let dest = Game.rooms[this.memory.base].storage.pos
  let routes = PathFinder.search(start, {pos: dest, range: 2}, {plainCost: 2, swampCost: 3, roomCallback: function(rn) {
      let room = Game.rooms[rn]
      if (!room) return;
      let costs = new PathFinder.CostMatrix;

      // Prefer road construction site
      room.find(FIND_MY_CONSTRUCTION_SITES, {filter: (s) => s.structureType == STRUCTURE_ROAD || s.structureType == STRUCTURE_CONTAINER}).forEach(s => costs.set(s.pos.x, s.pos.y, 1))

      room.find(FIND_STRUCTURES).forEach(s => {
        if (s.structureType == STRUCTURE_ROAD || s.structureType == STRUCTURE_CONTAINER) {
          // Prefer road
          costs.set(s.pos.x, s.pos.y, 1)
        }
        else if (s.structureType != STRUCTURE_CONTAINER && s.structureType != STRUCTURE_RAMPART || !s.my) {
          // Avoid impassable structures
          costs.set(s.pos.x, s.pos.y, 255)
        }
      })

      return costs
    }
  })

  // console.log('length: ' + routes.path.length);
  let roundTripTicks = routes.path.length * 2
  let energyPerTicks = 3000 / 300
  let totalEnergyPerTrip = energyPerTicks * roundTripTicks
  // console.log(totalEnergyPerTrip);
  // console.log('CARRY: ' + Math.ceil(totalEnergyPerTrip/50)); // Total CARRY part needed

  for (const pos of routes.path) {
    pos.highlight()
  }
  return routes
};

function getPeasantBody(sets) {
  let body = [];
  for (let i = 0; i < sets; i++) {
    body.push(WORK)
  }
  for (let i = 0; i < sets; i++) {
    body.push(CARRY)
  }
  for (let i = 0; i < sets; i++) {
    body.push(MOVE)
  }
  return body
}

function getLevyBody(sets) {
  let body = [];
  for (let i = 0; i < sets; i++) {
    body.push(ATTACK)
  }
  for (let i = 0; i < sets; i++) {
    body.push(MOVE)
  }
  return body
}

function getCaravanBody(sets) {
  let body = [];
  for (let i = 0; i < sets; i++) {
    body.push(CARRY)
    body.push(CARRY)
  }
  for (let i = 0; i < sets; i++) {
    body.push(MOVE)
  }
  return body
}
