import mongoose from 'mongoose';
console.log('mongoose type:', typeof mongoose);
console.log('mongoose.default type:', typeof (mongoose.default));
console.log('mongoose.connect type:', typeof (mongoose && mongoose.connect));
const mm = mongoose.default;
console.log('mongoose.default connect type:', typeof (mm && mm.connect));
