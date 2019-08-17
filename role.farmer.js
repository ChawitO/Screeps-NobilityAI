module.exports = function(creep) {
  // If no assigned source, find one near the flag
  if (!creep.memory.assignment.id) {
    if (creep.memory.assignment.flag) {
      creep.memory.assignment.id = Game.flags[creep.memory.assignment.flag].pos.lookFor(LOOK_SOURCES)[0].id
    }
  }
  if (!creep.memory.energy.id) {
    creep.memory.energy.id = creep.memory.assignment.id
    creep.memory.energy.type = 'source'
  }
  let source = Game.getObjectById(creep.memory.assignment.id)
  if (!creep.memory.container) {
    // If no saved container, find one near the source.
    let containers = source.pos.findInRange(FIND_STRUCTURES, 1, {filter: {structureType: STRUCTURE_CONTAINER}})
    if (containers.length) {
      creep.memory.container = containers[0].id
    }
  }

  let container = Game.getObjectById(creep.memory.container)
  let site = creep.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 1, {filter: {structureType: STRUCTURE_CONTAINER}})[0]
  let pos = container ? container.pos : site ? site.pos : source.pos
  let result = creep.harvest(source)
  if (result == ERR_NOT_IN_RANGE || !creep.pos.isEqualTo(pos)) {
    creep.moveTo(pos, {visualizePathStyle: {stroke: '#ffaa00'}});
  }
  else if (result == ERR_NOT_ENOUGH_RESOURCES) {
    if (creep.carry.energy == 0) {
      let drop = creep.pos.findInRange(villages[creep.room.name].droppedEnergies, 1)[0]
      creep.pickup(drop)
    }
    if (site) {
      creep.build(site)
    }
    else {
      creep.repair(container)
    }
  }
};
