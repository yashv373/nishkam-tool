module sync2(input clk_a, input clk_b, input rst_b, input d, output q);
reg s1; always @(posedge clk_b) if (rst_b) s1 <= 0; else s1 <= d;
  assign q = s1; endmodule
