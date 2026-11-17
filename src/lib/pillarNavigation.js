export const PILLAR_MENUS={
 salud:[{path:'correr',label:'Running',icon:'run'},{path:'hidratacion',label:'Hidratación',icon:'water'},{path:'sueno',label:'Sueño',icon:'sleep'}],
 finanzas:[{path:'movimientos',label:'Registrar',icon:'wallet'},{path:'historial',label:'Gastos y detalles',icon:'list'},{path:'resumen',label:'Control',icon:'chart'},{path:'metas',label:'Metas',icon:'goal'},{path:'deudas',label:'Deudas',icon:'wallet'}],
 educacion:[{path:'estudiar',label:'Estudiar',icon:'study'},{path:'tareas',label:'Tareas',icon:'list'},{path:'progreso',label:'Progreso',icon:'chart'}]
}
export const firstPillarPath=pillar=>'/pilares/'+pillar+'/'+PILLAR_MENUS[pillar][0].path
