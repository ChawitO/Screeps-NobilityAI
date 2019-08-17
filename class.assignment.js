class Assignment {
  constructor(type, id, room, priority = 100) {
    this.type = type;
    this.id = id;
    this.room = room;
    this.priority = priority;
  }

  static getAssignment(){
    console.log('this b class func');
  }
}

module.exports = Assignment
