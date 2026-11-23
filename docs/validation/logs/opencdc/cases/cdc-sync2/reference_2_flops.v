module sync2(input clk_a, input clk_b, input rst_b, input d, output q);
  reg s1, s2;
  always @(posedge clk_b) if (rst_b) begin s1 <= 0; s2 <= 0; end else begin s1 <= d; s2 <= s1; end
  assign q = s2;
endmodule
