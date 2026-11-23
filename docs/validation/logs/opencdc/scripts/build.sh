cd /foss/designs/opencdc/src
cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=ON > ../cmake.log 2>&1
cmake --build build -j8 > ../build.log 2>&1; echo build=$? > ../build.status
ctest --test-dir build > ../ctest.log 2>&1; echo done >> ../build.status
