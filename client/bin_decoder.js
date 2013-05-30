

function ArrayBufferSer(arrayBuffer) {
  this.buffer = arrayBuffer;
  this.offset = 0;
  this.sections = this.readArray();
  this.headers = this.sections[0];
  this._headersIndex = {};
  for(var i = 0; i < this.headers.length; ++i) {
    this._headersIndex[this.headers[i]] = i;
  }
  if(this.sections.length > 1) {
    this.length = this.sections[1].length;
  }
}

ArrayBufferSer.INT8 = 1;
ArrayBufferSer.UINT8 = 2;
ArrayBufferSer.UINT8_CLAMP = 3;
ArrayBufferSer.INT16 = 4;
ArrayBufferSer.UINT16 = 5;
ArrayBufferSer.INT32 = 6;
ArrayBufferSer.UINT32 = 7;
ArrayBufferSer.FLOAT32 = 8;
//ArrayBufferSer.FLOAT64 = 9; not supported
ArrayBufferSer.STRING = 10;
ArrayBufferSer.BUFFER = 11;


ArrayBufferSer.prototype = {

   sizes: [NaN, 1, 1, 1, 2, 2, 4, 4, 4, 8],

   types: [
    null,
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array
   ],

  get: function(columnName) {
    var i = this._headersIndex[columnName]
    if(i != undefined) {
      return this.sections[i + 1]
    }
    return;
  },

  _paddingFor: function(offset, type) {
    var s = this.sizes[type]
    if(s) {
      var r = offset % s;
      return r == 0 ? 0 : s - r;
    }
    return 0;
  },

  readUInt32: function() {
    var i = new DataView(this.buffer).getUint32(this.offset);
    this.offset += 4;
    return i
  },

  readArray: function() {
    var type = this.readUInt32();
    var size = this.readUInt32();
    if(type < ArrayBufferSer.STRING) {
      var a = new this.types[type](this.buffer, this.offset, size/this.sizes[type]);
      this.offset += size;
      return a;
    } else if(type == ArrayBufferSer.STRING) {
      var target = this.offset + size;
      var b = [];
      while(this.offset < target) {
        this.offset += this._paddingFor(this.offset, ArrayBufferSer.INT32);
        var arr = this.readArray();
        if(arr) {
          var str = '';
          for(var i = 0; i < arr.length; ++i) {
            str += String.fromCharCode(arr[i]);
          }
          b.push(str);
        }
        // parse sttring
      }
      return b;
    } else if(type == ArrayBufferSer.BUFFER) {
      var b = [];
      var target = this.offset + size;
      while(this.offset < target) {
        this.offset += this._paddingFor(this.offset, ArrayBufferSer.INT32);
        b.push(this.readArray());
      }
      return b;
    }
  }

};
