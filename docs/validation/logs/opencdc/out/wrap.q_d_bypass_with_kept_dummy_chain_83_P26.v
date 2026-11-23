module sync2(input clk_a, input clk_b, input rst_b, input d, output q);
(* keep *) reg s1, s2; always @(posedge clk_b) if (rst_b) {s2, s1} <= 0; else begin s1 <= d; s2 <= s1; end
  assign q = d; endmodule
module wrap(input clk_a, input clk_b, input rst_b, input din, output q); reg dr; always @(posedge clk_a) dr <= din; sync2 u(.clk_a(clk_a),.clk_b(clk_b),.rst_b(rst_b),.d(dr),.q(q)); endmodule
