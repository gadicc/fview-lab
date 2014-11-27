// http://stackoverflow.com/questions/24102361/ip-address-storing-sorting-and-filtering-in-mongodb

// ip example: 192.168.2.1
inet_aton = function(ip){
    // split into octets
    var a = ip.split('.');
    var buffer = new ArrayBuffer(4);
    var dv = new DataView(buffer);
    for(var i = 0; i < 4; i++){
        dv.setUint8(i, a[i]);
    }
    return(dv.getUint32(0));
}

// num example: 3232236033
inet_ntoa = function(num){
    var nbuffer = new ArrayBuffer(4);
    var ndv = new DataView(nbuffer);
    ndv.setUint32(0, num);

    var a = new Array();
    for(var i = 0; i < 4; i++){
        a[i] = ndv.getUint8(i);
    }
    return a.join('.');
}