// ISCAS'85 c17 combinational benchmark (Brglez & Fujiwara, ISCAS 1985; public domain)
module c17(input n1, input n2, input n3, input n6, input n7, output n22, output n23);
  wire n10, n11, n16, n19;
  nand g10(n10, n1, n3);
  nand g11(n11, n3, n6);
  nand g16(n16, n2, n11);
  nand g19(n19, n11, n7);
  nand g22(n22, n10, n16);
  nand g23(n23, n16, n19);
endmodule
