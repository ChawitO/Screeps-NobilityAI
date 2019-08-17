StructureTower.prototype.guardRoom = function () {
  let enemy = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS)
  if (this.pos.getRangeTo(enemy) <= 10) {
    this.attack(enemy);
  }
  else if (this.energy / this.energyCapacity > 0.5) {
    if (enemy) {
      this.attack(enemy);
    }
    else {
      let damagedFriend = this.pos.findClosestByRange(FIND_MY_CREEPS, {filter: (c) => c.hits < c.hitsMax})
      if (damagedFriend) {
        this.heal(damagedFriend)
      }
      else {
        let damagedStructures = villages[this.room.name].damagedStructures
        if (damagedStructures.length) {
          damagedStructures.sort((a, b) => a.hits - b.hits)
          this.repair(damagedStructures[0])
      }
      }
    }
  }

// OLD
  // let damagedFriend = this.pos.findClosestByRange(FIND_MY_CREEPS, {filter: (c) => c.hits < c.hitsMax})
  // if (enemy && this.pos.getRangeTo(enemy) <= 10) {
  //   this.attack(enemy);
  // }
  // else if (enemy && this.energy / this.energyCapacity > 0.5) {
  //   this.attack(enemy);
  // }
  // else if (damagedFriend) {
  //   this.heal(damagedFriend)
  // }
  // else {
  //   let damagedBattlement = this.pos.findClosestByRange(FIND_STRUCTURES, {filter: (s) =>
  //       (s.structureType == STRUCTURE_RAMPART) && s.hits < 50000 // not fix wall yet
  //     })
  //   if (damagedBattlement) {
  //     this.repair(damagedBattlement)
  //   }
  // }
};
