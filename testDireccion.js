const { extraerProveedorYDireccion } = require('./services/facturaParser');
const text = `SENIAT
RIF J-401257623
INVERSIONES DE TODO Y MAS , C.A
AV OLLARVIDES CASA NRO 260 SECTOR PUERTA

MARAVEN PUNTA CARDON EDO. FALCON
ZONA POSTAL 4102

Cliente:LAPEPITERIA PF C.A

CI/RIF: J506979896 - EST:001

Dir:COOPERATIVA CARDON

00006090/CONTADO

Vendedor:VENDEDOR 1

INVERSIONES.DE TODO Y MAS 2012, C.A

FACTURA

FACTURA: 00006118

FECHA: 02-10-2025 HORA: 16:34

0,995xBs 2.202,20
00041-QUESO MOZZARELA PALMILAGO (E) Bs 2.191,19

0,5xBs 3.185,00
00048-TOCINETA BELILLA (E) Bs 1.592,50

|En USD$: 20.791

EXENTO Bs 3.783,69

EFECTIVO Bs 3.783,69

TOTAL Bs 3.783,69

TOTAL 19H Z7C0001917`;
const lineas = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
console.log(JSON.stringify(lineas, null, 2));
console.log(JSON.stringify(extraerProveedorYDireccion(lineas), null, 2));