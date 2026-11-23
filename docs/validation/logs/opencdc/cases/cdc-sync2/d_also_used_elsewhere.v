module sync2(input clk_a, input clk_b, input rst_b, input d, output q);
reg s1, s2, e; always @(posedge clk_b) if (rst_b) {s2, s1, e} <= 0; else begin s1 <= d; e <= d; s2 <= s1; end
  assign q = s2 & e; endmodule
