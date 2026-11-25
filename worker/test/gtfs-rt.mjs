// Fabrique de flux GTFS-RT pour les tests : un encodeur protobuf minimal.
const enc = new TextEncoder();
function varint(n) {
  const o = [];
  // int32 négatif : complément à deux sur 64 bits (dix octets). En entiers
  // exacts : 2 ** 64 - 60 en nombre flottant vaudrait 2 ** 64.
  let v = n < 0 ? (1n << 64n) + BigInt(n) : BigInt(n);
  do { let x = Number(v & 0x7fn); v >>= 7n; if (v) x |= 0x80; o.push(x); } while (v);
  return o;
}
const champ = (no, type, charge) => [...varint(no * 8 + type), ...charge];
const message = (no, octets) => champ(no, 2, [...varint(octets.length), ...octets]);
const chaine = (no, s) => message(no, [...enc.encode(s)]);
const entier = (no, n) => champ(no, 0, varint(n));

const evenement = (e) => [...(e.d !== undefined ? entier(1, e.d) : []), ...entier(2, e.t)];
function arret(a) {
  return [
    ...(a.arr ? message(2, evenement(a.arr)) : []),
    ...(a.dep ? message(3, evenement(a.dep)) : []),
    ...chaine(4, a.stop),
    ...(a.saute ? entier(5, 1) : []),
  ];
}

/** trajets : [{ id, annule, arrets: [{ stop, arr: {t, d}, dep: {t, d}, saute }] }] */
export function fluxGtfsRt(trajets) {
  const octets = [...message(1, chaine(1, '2.0'))];
  trajets.forEach((tr, i) => {
    const trip = [...chaine(1, tr.id), ...chaine(3, '20261125'), ...(tr.annule ? entier(4, 3) : [])];
    const tu = [...message(1, trip), ...tr.arrets.flatMap((a) => message(2, arret(a))), ...entier(4, 1795600000)];
    octets.push(...message(2, [...chaine(1, `e${i}`), ...message(3, tu)]));
  });
  return new Uint8Array(octets);
}
