class VillageCentre {
  constructor(roomName) {
    this.name = roomName
    this.room = Game.rooms[roomName];
    this.assignments = []
    this.spawnOrders = []
    this.ensure()
    this.structures = this.room.find(FIND_STRUCTURES);
    if (this.structures.length != Memory.rooms[this.name].buildingCount) {
      Memory.rooms[this.name].newBuilding = true
      Memory.rooms[this.name].buildingCount = this.structures.length
    }

    this.rcl = (this.room.controller) ? this.room.controller.level : undefined;

    this.creeps = _.filter(Game.creeps, (c) => c.room.name === this.name);
    this.hostileCreeps = this.room.find(FIND_HOSTILE_CREEPS);
    this.hostileCombatants = _.filter(this.hostileCreeps, (e) => e.getActiveBodyparts(ATTACK) || e.getActiveBodyparts(RANGED_ATTACK))
    this.spawns = this.retrieve('spawns', (room) => room.find(FIND_MY_SPAWNS));
    this.sources = this.retrieve('sources', (room) => room.find(FIND_SOURCES));
    this.damagedStructures = _.filter(this.structures, (s) => s.hits < s.hitsMax && s.structureType != STRUCTURE_WALL && s.structureType != STRUCTURE_RAMPART)
    this.energyConsumers = this.retrieve('energyConsumers', (room) => room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_TOWER ||
                                                                                                                    s.structureType == STRUCTURE_SPAWN ||
                                                                                                                    s.structureType == STRUCTURE_EXTENSION}));
    this.storage = this.room.storage
    this.towers = this.retrieve('towers', (room) => room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_TOWER}}));
    this.hostileStructures = this.room.find(FIND_HOSTILE_STRUCTURES, {filter: (s) => s.structureType !== STRUCTURE_CONTROLLER});
    this.constructionSites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
    this.tombstones = this.room.find(FIND_TOMBSTONES);
    this.containers = this.retrieve('containers', (room) => room.find(FIND_STRUCTURES, {filter: {structureType: STRUCTURE_CONTAINER}}));

    this.droppedEnergies = this.room.find(FIND_DROPPED_RESOURCES, {filter: {resourceType: RESOURCE_ENERGY}});
    this.sourceContainers = _.filter(this.containers, (s) => s.pos.findInRange(FIND_SOURCES, 1).length)
    this.controllerContainers = _.filter(this.containers, (s) => !s.pos.findInRange(FIND_SOURCES, 1).length &&
                                                                  s.pos.findInRange(FIND_STRUCTURES, 5, {filter: {structureType: STRUCTURE_CONTROLLER}}).length)

    this.createAssignments();
    this.createSpawnOrder();
    Memory.rooms[this.name].newBuilding = false
    Memory.rooms[this.name].newCreep = false
  }
}

module.exports = VillageCentre

VillageCentre.prototype.createAssignments = function() {
  const ASSIGNMENT_PRIORITY = {
    high: 000,
    repair: 100,
    build: {
      spawn: 210,
      tower: 220,
      container: 230,
      road: 240,
      extension: 250,
      storage: 260
    },
    low: 900
  };

  // Keep at least 1 creep upgrading the controller
  let upgradingCreep = _.sum(this.creeps, (c) => c.memory.assignment && c.memory.assignment.type == JOB.UPGRADE)
  if (!upgradingCreep && this.creeps.length > 5 && this.room.controller.my) {
    this.assignments.push(new Assignment(JOB.UPGRADE, this.room.controller.id, this.name, ASSIGNMENT_PRIORITY.high + 10))
  }

  // Add repair job
  let repairingCreeps = _.sum(this.creeps, (c) => c.memory.assignment && c.memory.assignment.type == JOB.REPAIR)
  for (const s of this.damagedStructures) {
    if (repairingCreeps < 1 && (s.hits / s.hitsMax) < 0.75 && ![STRUCTURE_RAMPART, STRUCTURE_WALL].includes(s.structureType)) {
      let weight = Math.floor(s.hits / s.hitsMax * 10)
      this.assignments.push(new Assignment(JOB.REPAIR, s.id, s.room.name, ASSIGNMENT_PRIORITY.repair + weight))
    }
    else if (this.room.controller.reservation && this.room.controller.reservation.username == 'Euruzilys') {
      this.assignments.push(new Assignment(JOB.REPAIR, s.id, s.room.name, ASSIGNMENT_PRIORITY.low))
    }
  }

  // Add energy supply job
  for (const s of this.energyConsumers) {
    if (s.energyCapacity && s.energy < s.energyCapacity) {
      this.assignments.push(new Assignment(JOB.SUPPLY, s.id, s.room.name, ASSIGNMENT_PRIORITY.high + 20))
    }
  }

  // Add energy transfer job
  for (const s of this.controllerContainers) {
    if (s.store.energy < s.storeCapacity) {
      this.assignments.push(new Assignment(JOB.TRANSFER, s.id, s.room.name, ASSIGNMENT_PRIORITY.high + 30))
    }
  }

  if (this.storage) {
    this.assignments.push(new Assignment(JOB.STORAGE, this.storage.id, this.room.name, ASSIGNMENT_PRIORITY.high + 90))
  }

  // Add building job
  for (const site of this.constructionSites) {
    let ratioWeight = Math.floor((site.progress / site.progressTotal) * 10)
    let priority = ASSIGNMENT_PRIORITY.build[site.structureType] - ratioWeight
    this.assignments.push(new Assignment(JOB.BUILD, site.id, site.room.name, priority))
  }
};

VillageCentre.prototype.createSpawnOrder = function() {
  let peasantLimits = 0
  for (const source of this.sources) {
    let freeTiles = source.room.lookForAtArea(LOOK_TERRAIN, source.pos.y-1, source.pos.x-1, source.pos.y+1, source.pos.x+1, true)
    freeTiles = _.sum(freeTiles, (t) => t.terrain !== 'wall')
    peasantLimits += freeTiles

    // Check if source has Farmer
    let hasFarmer = _.sum(this.creeps, (c) => c.memory.role == FARMER && c.memory.assignment.id == source.id)
    if (!hasFarmer && this.room.controller.level >= 2) {
      let order = {
        body: [WORK, WORK, WORK, WORK, WORK, MOVE],
        name: `Farmer-${Game.time % 1000}`,
        opts: {memory: {role: FARMER, type: 'civilian', energy: {}, action: 'working',
          assignment: {type: JOB.FARMING, id: source.id, room: source.room.name}
        }},
        priority: 040
      }
      this.spawnOrders.push(order)
    }
  }
  // Order Peasants amount
  peasantLimits = Math.min(peasantLimits, 8)
  let peasantWorkLimit = 20
  let peasants = _.filter(this.creeps, (c) => c.memory.role == PEASANT)
  let currentPeasantWork = 0
  for (const c of peasants) {
    currentPeasantWork += c.getActiveBodyparts(WORK)
  }
  if (currentPeasantWork < peasantWorkLimit && peasants.length < peasantLimits) {
    this.peasantSpawnOrder()
  }
  let caravanCounts = _.sum(this.creeps, (c) => c.memory.role == CARAVAN)
  if (caravanCounts < 1 && this.storage) {
    this.caravanSpawnOrder()
  }

  let cultistCreeps = _.sum(this.creeps, (c) => c.memory.role == CULTIST && (!c.memory.assignment || c.memory.assignment.type != JOB.INTER_ROOM_TRANSFER))
  let cultistLimit = this.storage ? Math.floor(this.storage.store.energy / 25000) : 0
  if (cultistCreeps < cultistLimit) {
    let sets = Math.min(Math.floor(this.room.energyCapacityAvailable / 200), 10)
    let order = {
      body: getPeasantBody(sets),
      name: `Cultist-${Game.time % 1000}`,
      opts: {memory: {role: CULTIST, type: CIVILIAN, energy: {}, assignment: new Assignment(JOB.WORSHIP, this.room.controller.id, this.room.name)}},
      priority: 050
    }
    this.spawnOrders.push(order)
  }
};

// TODO: retrieve() does not check if structure is destroyed
VillageCentre.prototype.retrieve = function (key, func, reset = Memory.rooms[this.name].newBuilding) {
  if (!Memory.rooms[this.name][key] || reset) {
    var returnData = func(this.room)

    Memory.rooms[this.name][key] = []
    for (const obj of returnData) {
      Memory.rooms[this.name][key].push(obj.id)
    }
  }
  else {
    var returnData = []

    for (const id of Memory.rooms[this.name][key]) {
      returnData.push(Game.getObjectById(id))
    }
  }

  return returnData
};

VillageCentre.prototype.ensure = function () {
  if (typeof Memory.rooms !== 'object') {
    Memory.rooms = {}
  }
  if (!Memory.rooms[this.name]) {
    Memory.rooms[this.name] = {}
  }
};

VillageCentre.prototype.peasantSpawnOrder = function() {
  let setCounts = Math.min(Math.floor(this.room.energyCapacityAvailable / 200), 8)
  if (this.room.energyAvailable >= setCounts * 200) {
    let order = {
      body: getPeasantBody(setCounts),
      name: `Peasant-${Game.time % 1000}`,
      opts: {memory: {role: PEASANT, type: 'civilian', energy: {}}},
      priority: 010
    }
    this.spawnOrders.push(order)
  }
  if (this.creeps.length < 3) {
    let sets = Math.max(Math.floor(this.room.energyAvailable / 200), 1)
    let order = {
      body: getPeasantBody(sets),
      name: `Peasant-${Game.time % 1000}`,
      opts: {memory: {role: PEASANT, type: 'civilian', energy: {}}},
      priority: 020
    }
    this.spawnOrders.push(order)
  }
}

VillageCentre.prototype.caravanSpawnOrder = function () {
  let sets = Math.min(Math.floor(this.room.energyCapacityAvailable / 150), 7)
  let order = {
    body: getCaravanBody(sets),
    name: `Caravan-${Game.time % 1000}`,
    opts: {memory: {role: CARAVAN, type: 'civilian', energy: {}}},
    priority: 030
  }
  this.spawnOrders.push(order)
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
