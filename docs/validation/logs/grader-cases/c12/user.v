module edge_detect(input clk, input rst, input d, output pulse);
  reg p;
  always @(posedge clk) if (rst) p <= 0; else p <= d;
  assign pulse = d;
endmodule
