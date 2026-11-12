module mux2(input [3:0] a, input [3:0] b, input sel, output [3:0] y);
  assign y = sel ? a : b;
endmodule
