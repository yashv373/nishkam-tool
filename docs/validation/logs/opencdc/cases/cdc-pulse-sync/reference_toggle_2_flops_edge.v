module pulse_sync(input clk_a, input clk_b, input rst_a, input rst_b, input pulse_in, output pulse_out);
  reg tog, s1, s2, s3;
  always @(posedge clk_a) if (rst_a) tog <= 0; else if (pulse_in) tog <= ~tog;
  always @(posedge clk_b) if (rst_b) begin s1 <= 0; s2 <= 0; s3 <= 0; end else begin s1 <= tog; s2 <= s1; s3 <= s2; end
  assign pulse_out = s2 ^ s3;
endmodule
