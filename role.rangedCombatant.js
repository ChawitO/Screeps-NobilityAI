module.exports = function(creep) {
  let enemies = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 6, {filter: (c) => _.sum(c.carry) >= 0.25 * c.carryCapacity});
  let enemyCombatants = villages[creep.room.name].hostileCombatants
  let enemy
  if (enemyCombatants.length) {
    enemy = creep.pos.findClosestByRange(enemyCombatants)
  }
  else {
    enemy = creep.pos.findClosestByRange(enemies)
  }

  let attempt1 = creep.rangedAttack(enemy)
  if (attempt1 == ERR_NOT_IN_RANGE) {
    creep.say('pursuit!')
    creep.moveTo(enemy, {visualizePathStyle: {stroke: '#FA7520'}});
    creep.rangedAttack(enemy)
  }
  else if (attempt1 == OK) {
    creep.say('🏹', true)
    let range = creep.pos.getRangeTo(enemy)
    if (range < 3) {
      let path = PathFinder.search(creep.pos, enemyCombatants.map(c => {return {pos: c.pos, range: 3}}), {flee: true}).path
      creep.moveByPath(path)
    }
  }

  if (!enemy) {
    let injuredFriends = _.filter(villages[creep.room.name].creeps, c => c.hits < c.hitsMax)
    if (injuredFriends.length) {
      let friend = creep.pos.findClosestByRange(injuredFriends)
      creep.say('⚕')
      if (creep.heal(friend) == ERR_NOT_IN_RANGE) {
        creep.moveTo(friend)
      }
    }
    else {
      creep.moveTo(creep.room.controller)
    }
  }
  else {
    creep.heal(creep)
  }
};
